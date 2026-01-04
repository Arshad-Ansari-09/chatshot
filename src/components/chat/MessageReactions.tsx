import React from 'react';
import { cn } from '@/lib/utils';

interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
}

interface MessageReactionsProps {
  reactions: Reaction[];
  currentUserId: string;
  isMine: boolean;
  onToggleReaction: (emoji: string) => void;
}

const MessageReactions: React.FC<MessageReactionsProps> = ({
  reactions,
  currentUserId,
  isMine,
  onToggleReaction,
}) => {
  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, Reaction[]>);

  return (
    <div 
      className={cn(
        'flex flex-wrap gap-1 mt-2',
        isMine ? 'justify-end' : 'justify-start'
      )}
    >
      {Object.entries(groupedReactions).map(([emoji, reactionList]) => {
        const hasMyReaction = reactionList.some(r => r.user_id === currentUserId);
        
        return (
          <button
            key={emoji}
            onClick={() => onToggleReaction(emoji)}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors',
              hasMyReaction
                ? 'bg-primary/30 border border-primary/50'
                : 'bg-muted/50 border border-transparent hover:bg-muted'
            )}
          >
            <span>{emoji}</span>
            <span className="font-medium">{reactionList.length}</span>
          </button>
        );
      })}
    </div>
  );
};

export default MessageReactions;
