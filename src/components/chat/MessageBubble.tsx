import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { renderMessageContent } from '@/lib/linkify';
import MessageMedia from './MessageMedia';
import MessageReactions from './MessageReactions';
import MessageActions from './MessageActions';
import { ChatTheme } from '@/lib/chatThemes';
import { cn } from '@/lib/utils';

export interface MessageData {
  id: string;
  content: string;
  sender_id: string;
  created_at: string;
  is_read: boolean;
  media_url?: string | null;
  media_type?: string | null;
  deleted_at?: string | null;
  reply_to_id?: string | null;
}

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

interface MessageBubbleProps {
  message: MessageData;
  isMine: boolean;
  isWorldChat: boolean;
  sender?: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
  currentTheme: ChatTheme;
  reactions: Reaction[];
  replyToMessage?: MessageData | null;
  currentUserId: string;
  onReply: (message: MessageData) => void;
  onDelete: (messageId: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onRemoveReaction: (messageId: string, emoji: string) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isMine,
  isWorldChat,
  sender,
  currentTheme,
  reactions,
  replyToMessage,
  currentUserId,
  onReply,
  onDelete,
  onReact,
  onRemoveReaction,
}) => {
  const [showActions, setShowActions] = useState(false);
  const isDeleted = !!message.deleted_at;

  const placeholders = new Set(['📷 Photo', '📷 Photos', '🎥 Video', '📎 File']);
  const shouldShowText = message.content?.trim().length > 0 && !placeholders.has(message.content);

  return (
    <div 
      className={`flex ${isMine ? 'justify-end' : 'justify-start'} animate-slide-up group`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      onTouchStart={() => setShowActions(true)}
    >
      {/* Avatar for other users in World Chat */}
      {isWorldChat && !isMine && (
        <Avatar className="w-8 h-8 mr-2 flex-shrink-0 mt-1">
          <AvatarImage src={sender?.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {sender?.full_name?.[0] || sender?.username?.[0] || '?'}
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className="relative">
        {/* Message Actions (on hover/touch) */}
        <MessageActions
          show={showActions && !isDeleted}
          isMine={isMine}
          onReply={() => onReply(message)}
          onDelete={isMine ? () => onDelete(message.id) : undefined}
          onReact={(emoji) => onReact(message.id, emoji)}
        />

        <div
          className={cn(
            'max-w-[80%] min-w-[120px] px-4 py-3 rounded-2xl relative',
            isMine
              ? `${currentTheme.sentBubble} ${currentTheme.sentText} rounded-br-md`
              : `${currentTheme.receivedBubble} ${currentTheme.receivedText} rounded-bl-md`,
            isDeleted && 'opacity-60 italic'
          )}
        >
          {/* Sender name for World Chat */}
          {isWorldChat && !isMine && sender && !isDeleted && (
            <p className="text-xs font-semibold text-purple-400 mb-1">
              {sender.full_name || sender.username || 'Unknown'}
            </p>
          )}
          
          {isDeleted ? (
            <p className="text-sm">🚫 This message was deleted</p>
          ) : (
            <>
              {/* Reply preview */}
              {replyToMessage && (
                <div className={cn(
                  'mb-2 p-2 rounded-lg text-xs border-l-2',
                  isMine 
                    ? 'bg-white/10 border-white/50' 
                    : 'bg-black/10 border-primary/50'
                )}>
                  <p className="font-semibold opacity-80 mb-0.5">
                    {replyToMessage.sender_id === currentUserId ? 'You' : 'Reply'}
                  </p>
                  <p className="opacity-70 truncate">
                    {replyToMessage.deleted_at 
                      ? '🚫 This message was deleted' 
                      : replyToMessage.content.slice(0, 50) + (replyToMessage.content.length > 50 ? '...' : '')
                    }
                  </p>
                </div>
              )}
              
              <MessageMedia message={message} />
              {shouldShowText && (
                <p className="text-sm break-words">{renderMessageContent(message.content)}</p>
              )}
            </>
          )}
          
          <p className={`text-xs mt-1 ${isMine ? 'opacity-70' : 'opacity-60'}`}>
            {format(new Date(message.created_at), 'h:mm a')}
          </p>

          {/* Reactions display */}
          {reactions.length > 0 && !isDeleted && (
            <MessageReactions
              reactions={reactions}
              currentUserId={currentUserId}
              isMine={isMine}
              onToggleReaction={(emoji) => {
                const hasReaction = reactions.some(r => r.user_id === currentUserId && r.emoji === emoji);
                if (hasReaction) {
                  onRemoveReaction(message.id, emoji);
                } else {
                  onReact(message.id, emoji);
                }
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
