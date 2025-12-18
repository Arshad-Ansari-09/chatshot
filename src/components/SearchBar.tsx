import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { WORLD_CHAT_ID } from '@/lib/constants';

interface Profile {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

const SearchBar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchUsers = async () => {
      if (!query.trim() || !user) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .neq('id', user.id)
        .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
        .limit(10);

      if (error) {
        console.error('Search error:', error);
      } else {
        setResults(data || []);
      }
      
      setIsSearching(false);
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [query, user]);

  const startConversation = async (profile: Profile) => {
    if (!user || loadingUserId) return;

    setLoadingUserId(profile.id);

    try {
      // Check if a private conversation already exists (excluding World Chat)
      const { data: existingParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)
        .neq('conversation_id', WORLD_CHAT_ID);

      const { data: otherParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', profile.id)
        .neq('conversation_id', WORLD_CHAT_ID);

      // Find conversation that exists in both sets (1:1 private chat)
      const userConvos = new Set(existingParticipants?.map(p => p.conversation_id) || []);
      const existingConvo = otherParticipants?.find(p => userConvos.has(p.conversation_id));

      if (existingConvo) {
        // Verify it's not a group chat
        const { data: convoData } = await supabase
          .from('conversations')
          .select('is_group')
          .eq('id', existingConvo.conversation_id)
          .single();

        if (convoData && !convoData.is_group) {
          navigate(`/chat/${existingConvo.conversation_id}`);
          setQuery('');
          setShowResults(false);
          setLoadingUserId(null);
          return;
        }
      }

      // Create new private conversation
      const convoId = crypto.randomUUID();

      const { error: convoError } = await supabase
        .from('conversations')
        .insert({ id: convoId, is_group: false });

      if (convoError) {
        toast.error('Failed to create conversation');
        setLoadingUserId(null);
        return;
      }

      // Add current user as participant first
      const { error: selfParticipantError } = await supabase
        .from('conversation_participants')
        .insert({ conversation_id: convoId, user_id: user.id });

      if (selfParticipantError) {
        toast.error('Failed to add participants');
        setLoadingUserId(null);
        return;
      }

      // Add other user as participant
      const { error: otherParticipantError } = await supabase
        .from('conversation_participants')
        .insert({ conversation_id: convoId, user_id: profile.id });

      if (otherParticipantError) {
        toast.error('Failed to add participants');
        setLoadingUserId(null);
        return;
      }

      // Navigate to the new private chat
      navigate(`/chat/${convoId}`);
      setQuery('');
      setShowResults(false);
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Failed to start conversation');
    } finally {
      setLoadingUserId(null);
    }
  };

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search friends..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowResults(true);
          }}
          onFocus={() => setShowResults(true)}
          className="pl-12 pr-10 h-12 rounded-2xl bg-muted border-0 focus-visible:ring-primary"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
            className="absolute right-4 top-1/2 -translate-y-1/2"
          >
            <X className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />
          </button>
        )}
      </div>

      {/* Search Results Overlay */}
      {showResults && query && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-2xl shadow-elevated border border-border overflow-hidden z-50 animate-scale-in">
          {isSearching ? (
            <div className="p-4 text-center text-muted-foreground">
              Searching...
            </div>
          ) : results.length > 0 ? (
            <div className="max-h-80 overflow-y-auto">
              {results.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => startConversation(profile)}
                  disabled={loadingUserId !== null}
                  className="w-full flex items-center gap-3 p-4 hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={profile.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {profile.full_name?.[0] || profile.username?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left flex-1">
                    <p className="font-medium text-foreground">
                      {profile.full_name || 'Unknown'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      @{profile.username || 'user'}
                    </p>
                  </div>
                  {loadingUserId === profile.id && (
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground">
              No users found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
