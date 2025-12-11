import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

interface ConversationWithDetails {
  id: string;
  is_group: boolean;
  name: string | null;
  updated_at: string;
  otherUser: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
    is_online: boolean;
  } | null;
  lastMessage: {
    content: string;
    created_at: string;
    sender_id: string;
  } | null;
  unreadCount: number;
}

const ChatList = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    if (!user) return;

    // Get user's conversations
    const { data: participations, error: partError } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id);

    if (partError || !participations?.length) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const conversationIds = participations.map(p => p.conversation_id);

    // Get conversation details
    const { data: convos, error: convoError } = await supabase
      .from('conversations')
      .select('*')
      .in('id', conversationIds)
      .order('updated_at', { ascending: false });

    if (convoError || !convos) {
      setConversations([]);
      setLoading(false);
      return;
    }

    // Get other participants for each conversation
    const conversationsWithDetails: ConversationWithDetails[] = await Promise.all(
      convos.map(async (convo) => {
        // Get other participant
        const { data: participants } = await supabase
          .from('conversation_participants')
          .select(`
            user_id,
            profiles!conversation_participants_user_id_fkey (
              id,
              username,
              full_name,
              avatar_url,
              is_online
            )
          `)
          .eq('conversation_id', convo.id)
          .neq('user_id', user.id)
          .single();

        // Get last message
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, created_at, sender_id')
          .eq('conversation_id', convo.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        // Get unread count
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', convo.id)
          .eq('is_read', false)
          .neq('sender_id', user.id);

        return {
          ...convo,
          otherUser: (participants?.profiles as any) || null,
          lastMessage: lastMsg || null,
          unreadCount: unreadCount || 0,
        };
      })
    );

    setConversations(conversationsWithDetails);
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();

    // Subscribe to realtime message updates
    const channel = supabase
      .channel('chat-list-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => fetchConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 p-4 bg-card rounded-2xl animate-pulse">
            <div className="w-14 h-14 rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-muted rounded" />
              <div className="h-3 w-40 bg-muted rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No conversations yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Search for friends to start chatting!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground px-1 mb-3">Messages</h2>
      {conversations.map((convo) => (
        <button
          key={convo.id}
          onClick={() => navigate(`/chat/${convo.id}`)}
          className="w-full flex items-center gap-3 p-4 bg-card hover:bg-accent rounded-2xl transition-colors shadow-card animate-fade-in"
        >
          <div className="relative">
            <Avatar className="w-14 h-14">
              <AvatarImage src={convo.otherUser?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {convo.otherUser?.full_name?.[0] || convo.otherUser?.username?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            {convo.otherUser?.is_online && (
              <span className="absolute bottom-0 right-0 w-4 h-4 bg-online rounded-full border-2 border-card" />
            )}
          </div>
          
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-foreground truncate">
                {convo.otherUser?.full_name || convo.otherUser?.username || 'Unknown'}
              </p>
              {convo.lastMessage && (
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDistanceToNow(new Date(convo.lastMessage.created_at), { addSuffix: false })}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground truncate">
                {convo.lastMessage 
                  ? `${convo.lastMessage.sender_id === user?.id ? 'You: ' : ''}${convo.lastMessage.content}`
                  : 'No messages yet'}
              </p>
              {convo.unreadCount > 0 && (
                <span className="flex-shrink-0 min-w-5 h-5 px-1.5 flex items-center justify-center text-xs font-medium text-primary-foreground bg-primary rounded-full">
                  {convo.unreadCount}
                </span>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

export default ChatList;
