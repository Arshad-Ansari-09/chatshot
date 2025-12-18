import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Send, Globe, Paperclip, X, FileText, Download, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { WORLD_CHAT_ID } from '@/lib/constants';
import { renderMessageContent } from '@/lib/linkify';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
  media_url?: string | null;
  media_type?: string | null;
}

interface OtherUser {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_online: boolean;
}

interface Participant {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

const Chat = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isWorldChat = id === WORLD_CHAT_ID;

  const getMediaType = (file: File): string => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'document';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setSelectedFile(file);
    
    // Create preview for images/videos
    if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      setPreviewUrl(URL.createObjectURL(file));
    } else {
      setPreviewUrl(null);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFile = async (file: File): Promise<string | null> => {
    if (!user) return null;
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('chat-media')
      .upload(fileName, file);

    if (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('chat-media')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

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

    if (isWorldChat) {
      // For World Chat, fetch all participants for avatars/names
      const { data: allParticipants, count } = await supabase
        .from('conversation_participants')
        .select(`
          profiles!conversation_participants_user_id_fkey (
            id,
            username,
            full_name,
            avatar_url
          )
        `, { count: 'exact' })
        .eq('conversation_id', id);

      if (allParticipants) {
        const participantMap: Record<string, Participant> = {};
        allParticipants.forEach((p: any) => {
          if (p.profiles) {
            participantMap[p.profiles.id] = p.profiles;
          }
        });
        setParticipants(participantMap);
        setParticipantCount(count || 0);
      }
      setLoading(false);
      return;
    }

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
      .maybeSingle();

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
    if ((!newMessage.trim() && !selectedFile) || !user || !id || sending || uploading) return;

    setSending(true);
    const messageContent = newMessage.trim();
    setNewMessage('');

    let mediaUrl: string | null = null;
    let mediaType: string | null = null;

    if (selectedFile) {
      setUploading(true);
      mediaUrl = await uploadFile(selectedFile);
      mediaType = getMediaType(selectedFile);
      setUploading(false);
      clearSelectedFile();

      if (!mediaUrl) {
        setSending(false);
        return;
      }
    }

    const { error } = await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: user.id,
      content: messageContent || (mediaType === 'image' ? '📷 Photo' : mediaType === 'video' ? '🎥 Video' : '📎 File'),
      media_url: mediaUrl,
      media_type: mediaType,
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

  const renderMediaContent = (message: Message) => {
    if (!message.media_url) return null;

    if (message.media_type === 'image') {
      return (
        <img 
          src={message.media_url} 
          alt="Shared image" 
          className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity"
          style={{ maxHeight: '300px' }}
          onClick={() => window.open(message.media_url!, '_blank')}
        />
      );
    }

    if (message.media_type === 'video') {
      return (
        <video 
          src={message.media_url} 
          controls 
          className="max-w-full rounded-lg mb-2"
          style={{ maxHeight: '300px' }}
        />
      );
    }

    // Document/other files
    const fileName = message.media_url.split('/').pop() || 'File';
    return (
      <a 
        href={message.media_url} 
        target="_blank" 
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 bg-background/20 rounded-lg mb-2 hover:bg-background/30 transition-colors"
      >
        <FileText className="w-5 h-5" />
        <span className="text-sm truncate flex-1">{fileName}</span>
        <Download className="w-4 h-4" />
      </a>
    );
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
      <header className={`sticky top-0 z-50 backdrop-blur-lg border-b border-border ${
        isWorldChat 
          ? 'bg-gradient-to-r from-purple-500/10 to-blue-500/10' 
          : 'bg-card/80'
      }`}>
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
              {isWorldChat ? (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <Globe className="w-5 h-5 text-white" />
                </div>
              ) : (
                <>
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={otherUser?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {otherUser?.full_name?.[0] || otherUser?.username?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  {otherUser?.is_online && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-online rounded-full border-2 border-card" />
                  )}
                </>
              )}
            </div>
            <div>
              <p className={`font-semibold ${isWorldChat ? 'text-purple-400' : 'text-foreground'}`}>
                {isWorldChat ? 'World Chat' : (otherUser?.full_name || otherUser?.username || 'Unknown')}
              </p>
              <p className="text-xs text-muted-foreground">
                {isWorldChat 
                  ? `${participantCount} members` 
                  : (otherUser?.is_online ? 'Online' : 'Offline')}
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
                {isWorldChat 
                  ? 'Be the first to say hello to the world!'
                  : 'Send a message to start the conversation!'}
              </p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isMine = message.sender_id === user?.id;
              const showDate = index === 0 || 
                format(new Date(message.created_at), 'yyyy-MM-dd') !== 
                format(new Date(messages[index - 1].created_at), 'yyyy-MM-dd');
              
              const sender = isWorldChat && !isMine ? participants[message.sender_id] : null;

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
                    {/* Avatar for other users in World Chat */}
                    {isWorldChat && !isMine && (
                      <Avatar className="w-8 h-8 mr-2 flex-shrink-0 mt-1">
                        <AvatarImage src={sender?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {sender?.full_name?.[0] || sender?.username?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                        isMine
                          ? 'bg-message-sent text-primary-foreground rounded-br-md'
                          : 'bg-message-received text-foreground rounded-bl-md'
                      }`}
                    >
                      {/* Sender name for World Chat */}
                      {isWorldChat && !isMine && sender && (
                        <p className="text-xs font-semibold text-purple-400 mb-1">
                          {sender.full_name || sender.username || 'Unknown'}
                        </p>
                      )}
                      {renderMediaContent(message)}
                      {(!message.media_url || message.content !== '📷 Photo' && message.content !== '🎥 Video' && message.content !== '📎 File') && (
                        <p className="text-sm break-words">{renderMessageContent(message.content)}</p>
                      )}
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
        {/* File Preview */}
        {selectedFile && (
          <div className="max-w-2xl mx-auto mb-3">
            <div className="relative inline-block">
              {previewUrl && selectedFile.type.startsWith('image/') ? (
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="max-h-32 rounded-lg"
                />
              ) : previewUrl && selectedFile.type.startsWith('video/') ? (
                <video 
                  src={previewUrl} 
                  className="max-h-32 rounded-lg"
                />
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                  <FileText className="w-5 h-5" />
                  <span className="text-sm truncate max-w-[200px]">{selectedFile.name}</span>
                </div>
              )}
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                onClick={clearSelectedFile}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
        
        <form onSubmit={sendMessage} className="max-w-2xl mx-auto flex gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            className="hidden"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="h-12 w-12 rounded-full hover:bg-accent"
          >
            <Paperclip className="w-5 h-5" />
          </Button>
          <Input
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1 h-12 rounded-2xl bg-muted border-0 focus-visible:ring-primary"
          />
          <Button
            type="submit"
            size="icon"
            disabled={(!newMessage.trim() && !selectedFile) || sending || uploading}
            className="h-12 w-12 rounded-full gradient-primary hover:opacity-90 transition-opacity"
          >
            {uploading ? (
              <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-primary-foreground" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
