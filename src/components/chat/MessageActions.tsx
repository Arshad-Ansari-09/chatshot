import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Reply, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

interface MessageActionsProps {
  show: boolean;
  isMine: boolean;
  onReply: () => void;
  onDelete?: () => void;
  onReact: (emoji: string) => void;
}

const MessageActions: React.FC<MessageActionsProps> = ({
  show,
  isMine,
  onReply,
  onDelete,
  onReact,
}) => {
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  if (!show) return null;

  return (
    <div 
      className={cn(
        'absolute -top-10 flex items-center gap-1 z-10 animate-fade-in',
        isMine ? 'right-0' : 'left-0'
      )}
    >
      {/* Reaction picker */}
      {showReactionPicker && (
        <div className="flex items-center gap-1 bg-card border border-border rounded-full px-2 py-1 shadow-lg mr-1">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReact(emoji);
                setShowReactionPicker(false);
              }}
              className="text-lg hover:scale-125 transition-transform p-1"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 bg-card border border-border rounded-full px-1 py-1 shadow-lg">
        {/* Quick reaction button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full"
          onClick={() => setShowReactionPicker(!showReactionPicker)}
        >
          <span className="text-sm">😊</span>
        </Button>

        {/* Reply button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full"
          onClick={onReply}
        >
          <Reply className="w-4 h-4" />
        </Button>

        {/* Delete button (only for own messages) */}
        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default MessageActions;
