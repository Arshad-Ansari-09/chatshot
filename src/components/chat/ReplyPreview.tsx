import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReplyPreviewProps {
  replyToMessage: {
    id: string;
    content: string;
    sender_id: string;
  };
  currentUserId: string;
  onClear: () => void;
}

const ReplyPreview: React.FC<ReplyPreviewProps> = ({
  replyToMessage,
  currentUserId,
  onClear,
}) => {
  const isOwnMessage = replyToMessage.sender_id === currentUserId;

  return (
    <div className="max-w-2xl mx-auto mb-3">
      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border-l-4 border-primary">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-primary mb-0.5">
            Replying to {isOwnMessage ? 'yourself' : 'message'}
          </p>
          <p className="text-sm text-muted-foreground truncate">
            {replyToMessage.content.slice(0, 100)}{replyToMessage.content.length > 100 ? '...' : ''}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full flex-shrink-0"
          onClick={onClear}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default ReplyPreview;
