import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Send } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
}

interface OtherUser {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_online: boolean;
}

const Chat = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchMessages = async () => {
    if (!id || !user) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    setMessages(data || []);

    // Mark messages as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', id)
      .neq('sender_id', user.id)
      .eq('is_read', false);
  };

  const fetchOtherUser = async () => {
    if (!id || !user) return;

    const { data, error } = await supabase
      .from('conversation_participants')
      .select(`
        profiles!conversation_participants_user_id_fkey (
          id,
          username,
          full_name,
          avatar_url,
          is_online
        )
      `)
      .eq('conversation_id', id)
      .neq('user_id', user.id)
      .single();

    if (!error && data) {
      setOtherUser(data.profiles as any);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMessages();
    fetchOtherUser();

    // Subscribe to realtime messages
    const channel = supabase
      .channel(`messages-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !id || sending) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    const { error } = await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: user.id,
      content: messageContent,
    });

    if (error) {
      toast.error('Failed to send message');
      setNewMessage(messageContent);
    }

    // Update conversation timestamp
    await supabase
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', id);

    setSending(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-primary">Loading chat...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="rounded-full hover:bg-accent"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          
          <div className="flex items-center gap-3 flex-1">
            <div className="relative">
              <Avatar className="w-10 h-10">
                <AvatarImage src={otherUser?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {otherUser?.full_name?.[0] || otherUser?.username?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              {otherUser?.is_online && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-online rounded-full border-2 border-card" />
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {otherUser?.full_name || otherUser?.username || 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground">
                {otherUser?.is_online ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Send a message to start the conversation!
              </p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isMine = message.sender_id === user?.id;
              const showDate = index === 0 || 
                format(new Date(message.created_at), 'yyyy-MM-dd') !== 
                format(new Date(messages[index - 1].created_at), 'yyyy-MM-dd');

              return (
                <React.Fragment key={message.id}>
                  {showDate && (
                    <div className="flex justify-center">
                      <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {format(new Date(message.created_at), 'MMMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} animate-slide-up`}>
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                        isMine
                          ? 'bg-message-sent text-primary-foreground rounded-br-md'
                          : 'bg-message-received text-foreground rounded-bl-md'
                      }`}
                    >
                      <p className="text-sm break-words">{message.content}</p>
                      <p className={`text-xs mt-1 ${isMine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {format(new Date(message.created_at), 'h:mm a')}
                      </p>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="sticky bottom-0 bg-card/80 backdrop-blur-lg border-t border-border p-4">
        <form onSubmit={sendMessage} className="max-w-2xl mx-auto flex gap-3">
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 h-12 rounded-2xl bg-muted border-0 focus-visible:ring-primary"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!newMessage.trim() || sending}
            className="h-12 w-12 rounded-full gradient-primary hover:opacity-90 transition-opacity"
          >
            <Send className="w-5 h-5 text-primary-foreground" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
