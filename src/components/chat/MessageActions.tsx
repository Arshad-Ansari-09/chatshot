import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Reply, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (!show) return null;

  return (
    <>
      <div
        className={cn(
          'absolute -top-10 flex items-center gap-1 z-10 animate-fade-in',
          isMine ? 'right-0' : 'left-0'
        )}
      >
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
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={() => setShowReactionPicker(!showReactionPicker)}
          >
            <span className="text-sm">😊</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full"
            onClick={onReply}
          >
            <Reply className="w-4 h-4" />
          </Button>

          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full text-destructive hover:text-destructive"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This message will be deleted for everyone in this chat. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                onDelete?.();
                setConfirmOpen(false);
              }}
            >
              Delete for everyone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MessageActions;
