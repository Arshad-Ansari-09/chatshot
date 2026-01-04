import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArrowLeft, Send, Globe, Paperclip, X, FileText, Loader2, Settings } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { WORLD_CHAT_ID } from '@/lib/constants';
import { compressImage } from '@/lib/imageCompression';
import { Progress } from '@/components/ui/progress';
import ThemePicker from '@/components/chat/ThemePicker';
import { getThemeById } from '@/lib/chatThemes';
import MessageBubble, { MessageData, Reaction } from '@/components/chat/MessageBubble';
import ReplyPreview from '@/components/chat/ReplyPreview';

interface OtherUser {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_online: boolean;
  last_seen: string | null;
}

interface Participant {
  id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

interface SelectedFileInfo {
  file: File;
  previewUrl: string | null;
}

const Chat = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null);
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const [participantCount, setParticipantCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileInfo[]>([]);
  const [conversationTheme, setConversationTheme] = useState('default');
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [themeUpdating, setThemeUpdating] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageData | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isWorldChat = id === WORLD_CHAT_ID;
  const currentTheme = getThemeById(conversationTheme);

  const getMediaType = (file: File): string => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    return 'document';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate total size and count
    const MAX_FILES = 10;
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB per file

    if (files.length > MAX_FILES) {
      toast.error(`You can only select up to ${MAX_FILES} files at once`);
      return;
    }

    const invalidFiles = files.filter(f => f.size > MAX_SIZE);
    if (invalidFiles.length > 0) {
      toast.error('Some files exceed the 10MB limit');
      return;
    }

    // Create previews for each file
    const newFiles: SelectedFileInfo[] = files.map(file => ({
      file,
      previewUrl: file.type.startsWith('image/') || file.type.startsWith('video/')
        ? URL.createObjectURL(file)
        : null,
    }));

    setSelectedFiles(prev => [...prev, ...newFiles].slice(0, MAX_FILES));
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => {
      const file = prev[index];
      if (file.previewUrl) {
        URL.revokeObjectURL(file.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const clearSelectedFiles = () => {
    selectedFiles.forEach(f => {
      if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
    });
    setSelectedFiles([]);
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

  const scrollToBottom = (instant = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: instant ? 'instant' : 'smooth' });
    }
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

    // Scroll to bottom instantly after loading messages
    setTimeout(() => scrollToBottom(true), 50);

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
          is_online,
          last_seen
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

  // Mark messages as read function
  const markMessagesAsRead = async () => {
    if (!id || !user) return;
    
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', id)
      .neq('sender_id', user.id)
      .eq('is_read', false);
  };

  // Fetch conversation theme
  const fetchConversationTheme = async () => {
    if (!id) return;
    
    const { data, error } = await supabase
      .from('conversations')
      .select('theme')
      .eq('id', id)
      .single();
    
    if (!error && data?.theme) {
      setConversationTheme(data.theme);
    }
  };

  // Fetch reactions for all messages
  const fetchReactions = async () => {
    if (!id) return;
    
    const { data, error } = await supabase
      .from('message_reactions')
      .select('*')
      .in('message_id', messages.map(m => m.id));
    
    if (!error && data) {
      setReactions(data);
    }
  };

  // Update theme for conversation
  const handleThemeChange = async (themeId: string) => {
    if (!id) return;
    
    setThemeUpdating(true);
    const { error } = await supabase
      .from('conversations')
      .update({ theme: themeId })
      .eq('id', id);
    
    if (error) {
      toast.error('Failed to update theme');
    } else {
      setConversationTheme(themeId);
      setThemePickerOpen(false);
    }
    setThemeUpdating(false);
  };

  // Delete message (soft delete)
  const handleDeleteMessage = async (messageId: string) => {
    const { error } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId)
      .eq('sender_id', user?.id);
    
    if (error) {
      toast.error('Failed to delete message');
    } else {
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, deleted_at: new Date().toISOString() } : m
      ));
    }
  };

  // Add reaction
  const handleAddReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('message_reactions')
      .insert({ message_id: messageId, user_id: user.id, emoji })
      .select()
      .single();
    
    if (error) {
      if (error.code === '23505') {
        // Already reacted with this emoji, ignore
        return;
      }
      toast.error('Failed to add reaction');
    } else if (data) {
      setReactions(prev => [...prev, data]);
    }
  };

  // Remove reaction
  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji);
    
    if (error) {
      toast.error('Failed to remove reaction');
    } else {
      setReactions(prev => prev.filter(r => 
        !(r.message_id === messageId && r.user_id === user.id && r.emoji === emoji)
      ));
    }
  };

  // Set message to reply to
  const handleReply = (message: MessageData) => {
    setReplyingTo(message);
  };

  useEffect(() => {
    fetchMessages();
    fetchOtherUser();
    fetchConversationTheme();

    // Subscribe to realtime messages
    const messagesChannel = supabase
      .channel(`messages-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        async (payload) => {
          const newMsg = payload.new as MessageData;
          setMessages((prev) => [...prev, newMsg]);
          
          // If the new message is from someone else, mark it as read immediately
          if (newMsg.sender_id !== user?.id) {
            await markMessagesAsRead();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${id}`,
        },
        (payload) => {
          const updatedMsg = payload.new as MessageData;
          setMessages((prev) => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
        }
      )
      .subscribe();

    // Subscribe to conversation theme changes for real-time sync
    const themeChannel = supabase
      .channel(`conversation-theme-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversations',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          const updated = payload.new as { theme?: string };
          if (updated.theme) {
            setConversationTheme(updated.theme);
          }
        }
      )
      .subscribe();

    // Subscribe to reactions changes
    const reactionsChannel = supabase
      .channel(`reactions-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newReaction = payload.new as Reaction;
            setReactions((prev) => [...prev, newReaction]);
          } else if (payload.eventType === 'DELETE') {
            const oldReaction = payload.old as Reaction;
            setReactions((prev) => prev.filter(r => r.id !== oldReaction.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(themeChannel);
      supabase.removeChannel(reactionsChannel);
    };
  }, [id, user]);

  // Fetch reactions when messages change
  useEffect(() => {
    if (messages.length > 0) {
      fetchReactions();
    }
  }, [messages.length]);

  // Auto-scroll when new messages arrive
  const prevMessagesCount = useRef(messages.length);
  useEffect(() => {
    if (messages.length > prevMessagesCount.current) {
      // New message arrived - smooth scroll
      scrollToBottom(false);
    }
    prevMessagesCount.current = messages.length;
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && selectedFiles.length === 0) || !user || !id || sending || uploading) return;

    setSending(true);
    const messageContent = newMessage.trim();
    const currentReplyToId = replyingTo?.id || null;
    setNewMessage('');
    setReplyingTo(null);

    // If there are files to upload
    if (selectedFiles.length > 0) {
      setUploading(true);
      setUploadProgress(0);

      const totalFiles = selectedFiles.length;
      let uploadedCount = 0;

      const imageUrls: string[] = [];
      const otherUploads: Array<{ url: string; type: string }> = [];

      for (const fileInfo of selectedFiles) {
        try {
          let fileToUpload = fileInfo.file;

          if (fileInfo.file.type.startsWith('image/')) {
            fileToUpload = await compressImage(fileInfo.file, {
              maxWidth: 1280,
              maxHeight: 1280,
              quality: 0.8,
              outputType: 'image/jpeg',
            });
          }

          const mediaUrl = await uploadFile(fileToUpload);
          const mediaType = getMediaType(fileInfo.file);

          if (mediaUrl) {
            if (mediaType === 'image') imageUrls.push(mediaUrl);
            else otherUploads.push({ url: mediaUrl, type: mediaType });
          }

          uploadedCount++;
          setUploadProgress(Math.round((uploadedCount / totalFiles) * 100));
        } catch (error) {
          console.error('Upload error:', error);
          toast.error(`Failed to upload ${fileInfo.file.name}`);
        }
      }

      try {
        const usesCaptionForMedia = messageContent.length > 0;

        // Images: send as a single bubble (gallery) when multiple
        if (imageUrls.length > 1) {
          await supabase.from('messages').insert({
            conversation_id: id,
            sender_id: user.id,
            content: usesCaptionForMedia ? messageContent : '📷 Photos',
            media_type: 'gallery',
            media_url: JSON.stringify(imageUrls),
            reply_to_id: currentReplyToId,
          });
        } else if (imageUrls.length === 1) {
          await supabase.from('messages').insert({
            conversation_id: id,
            sender_id: user.id,
            content: usesCaptionForMedia ? messageContent : '📷 Photo',
            media_type: 'image',
            media_url: imageUrls[0],
            reply_to_id: currentReplyToId,
          });
        }

        // Non-images: send one bubble per file (caption only if we didn't use it on images)
        for (let i = 0; i < otherUploads.length; i++) {
          const u = otherUploads[i];
          const shouldUseCaption = messageContent.length > 0 && imageUrls.length === 0 && i === 0;

          const fallbackLabel =
            u.type === 'video' ? '🎥 Video' : u.type === 'document' ? '📎 File' : '📎 File';

          await supabase.from('messages').insert({
            conversation_id: id,
            sender_id: user.id,
            content: shouldUseCaption ? messageContent : fallbackLabel,
            media_url: u.url,
            media_type: u.type,
            reply_to_id: i === 0 ? currentReplyToId : null,
          });
        }
      } catch (err) {
        console.error('Error creating media message(s):', err);
        toast.error('Failed to send media');
      }

      clearSelectedFiles();
      setUploading(false);
      setUploadProgress(0);
    } else if (messageContent) {
      // Text-only message
      const { error } = await supabase.from('messages').insert({
        conversation_id: id,
        sender_id: user.id,
        content: messageContent,
        reply_to_id: currentReplyToId,
      });

      if (error) {
        toast.error('Failed to send message');
        setNewMessage(messageContent);
      }
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
    <div className={`min-h-screen flex flex-col ${currentTheme.background}`}>
      {/* Theme Picker Modal */}
      <ThemePicker
        open={themePickerOpen}
        onOpenChange={setThemePickerOpen}
        currentTheme={conversationTheme}
        onSelectTheme={handleThemeChange}
        isLoading={themeUpdating}
      />

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
                  : otherUser?.is_online 
                    ? 'Online' 
                    : otherUser?.last_seen 
                      ? `Last seen ${formatDistanceToNow(new Date(otherUser.last_seen), { addSuffix: true })}`
                      : 'Offline'}
              </p>
            </div>
          </div>

          {/* Theme Settings Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setThemePickerOpen(true)}
            className="rounded-full hover:bg-accent"
          >
            <Settings className="w-5 h-5" />
          </Button>
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
              const messageReactions = reactions.filter(r => r.message_id === message.id);
              const replyToMessage = message.reply_to_id 
                ? messages.find(m => m.id === message.reply_to_id) 
                : null;

              return (
                <React.Fragment key={message.id}>
                  {showDate && (
                    <div className="flex justify-center">
                      <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {format(new Date(message.created_at), 'MMMM d, yyyy')}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={message}
                    isMine={isMine}
                    isWorldChat={isWorldChat}
                    sender={sender}
                    currentTheme={currentTheme}
                    reactions={messageReactions}
                    replyToMessage={replyToMessage}
                    currentUserId={user?.id || ''}
                    onReply={handleReply}
                    onDelete={handleDeleteMessage}
                    onReact={handleAddReaction}
                    onRemoveReaction={handleRemoveReaction}
                  />
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Message Input */}
      <div className="sticky bottom-0 bg-card/80 backdrop-blur-lg border-t border-border p-4">
        {/* Reply Preview */}
        {replyingTo && (
          <ReplyPreview
            replyToMessage={replyingTo}
            currentUserId={user?.id || ''}
            onClear={() => setReplyingTo(null)}
          />
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="max-w-2xl mx-auto mb-3">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1">
                  Uploading {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''}...
                </p>
                <Progress value={uploadProgress} className="h-2" />
              </div>
              <span className="text-sm font-medium text-foreground">{uploadProgress}%</span>
            </div>
          </div>
        )}

        {/* File Previews */}
        {selectedFiles.length > 0 && !uploading && (
          <div className="max-w-2xl mx-auto mb-3">
            <div className="flex gap-2 flex-wrap">
              {selectedFiles.map((fileInfo, index) => (
                <div key={index} className="relative">
                  {fileInfo.previewUrl && fileInfo.file.type.startsWith('image/') ? (
                    <img 
                      src={fileInfo.previewUrl} 
                      alt="Preview" 
                      className="h-20 w-20 object-cover rounded-lg"
                    />
                  ) : fileInfo.previewUrl && fileInfo.file.type.startsWith('video/') ? (
                    <div className="h-20 w-20 bg-muted rounded-lg flex items-center justify-center">
                      <video 
                        src={fileInfo.previewUrl} 
                        className="h-20 w-20 object-cover rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="h-20 w-20 flex flex-col items-center justify-center gap-1 bg-muted rounded-lg p-2">
                      <FileText className="w-6 h-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground truncate w-full text-center">
                        {fileInfo.file.name.slice(0, 8)}...
                      </span>
                    </div>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full"
                    onClick={() => removeSelectedFile(index)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
            </p>
          </div>
        )}
        
        <form onSubmit={sendMessage} className="max-w-2xl mx-auto flex gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            multiple
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
            disabled={(!newMessage.trim() && selectedFiles.length === 0) || sending || uploading}
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
