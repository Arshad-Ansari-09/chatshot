import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { chatThemes, ChatTheme } from '@/lib/chatThemes';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThemePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTheme: string;
  onSelectTheme: (themeId: string) => void;
  isLoading?: boolean;
}

const ThemePicker: React.FC<ThemePickerProps> = ({
  open,
  onOpenChange,
  currentTheme,
  onSelectTheme,
  isLoading,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chat Theme</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-3 py-4">
          {chatThemes.map((theme) => (
            <button
              key={theme.id}
              onClick={() => onSelectTheme(theme.id)}
              disabled={isLoading}
              className={cn(
                'flex flex-col items-center gap-2 p-2 rounded-xl transition-all',
                'hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary',
                currentTheme === theme.id && 'bg-accent ring-2 ring-primary'
              )}
            >
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center',
                  theme.preview
                )}
              >
                {currentTheme === theme.id && (
                  <Check className="w-5 h-5 text-white" />
                )}
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                {theme.name}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ThemePicker;
