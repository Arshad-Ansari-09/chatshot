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
        .rpc('search_users', { search_query: query.trim() });

      if (error) {
        console.error('Search error:', error);
        setResults([]);
      } else {
        setResults((data as Profile[]) || []);
      }
      
      setIsSearching(false);
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [query, user]);

  const startConversation = async (profile: Profile) => {
    if (!user || loadingUserId) return;

    setLoadingUserId(profile.id);
    console.log('[startConversation] Initiating chat with:', profile.id);

    try {
      // Use the atomic RPC function for get-or-create logic
      const { data: conversationId, error: rpcError } = await supabase
        .rpc('get_or_create_private_conversation', { _other_user_id: profile.id });

      if (rpcError) {
        console.error('[startConversation] RPC error:', {
          code: rpcError.code,
          message: rpcError.message,
          details: rpcError.details,
          hint: rpcError.hint,
        });
        toast.error('Failed to create conversation');
        return;
      }

      if (!conversationId) {
        console.error('[startConversation] No conversation ID returned');
        toast.error('Failed to create conversation');
        return;
      }

      console.log('[startConversation] Success, navigating to:', conversationId);
      navigate(`/chat/${conversationId}`);
      setQuery('');
      setShowResults(false);
    } catch (error) {
      console.error('[startConversation] Unexpected error:', error);
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
