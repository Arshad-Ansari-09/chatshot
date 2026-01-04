export interface ChatTheme {
  id: string;
  name: string;
  background: string;
  sentBubble: string;
  sentText: string;
  receivedBubble: string;
  receivedText: string;
  preview: string; // For the picker preview
}

export const chatThemes: ChatTheme[] = [
  {
    id: 'default',
    name: 'Default',
    background: 'bg-background',
    sentBubble: 'bg-message-sent',
    sentText: 'text-primary-foreground',
    receivedBubble: 'bg-message-received',
    receivedText: 'text-foreground',
    preview: 'bg-gradient-to-br from-primary to-primary/80',
  },
  {
    id: 'lavender',
    name: 'Lavender',
    background: 'bg-gradient-to-b from-purple-950/40 to-background',
    sentBubble: 'bg-gradient-to-br from-purple-500 to-violet-600',
    sentText: 'text-white',
    receivedBubble: 'bg-purple-900/40',
    receivedText: 'text-purple-50',
    preview: 'bg-gradient-to-br from-purple-500 to-violet-600',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    background: 'bg-gradient-to-b from-cyan-950/40 to-background',
    sentBubble: 'bg-gradient-to-br from-cyan-500 to-blue-600',
    sentText: 'text-white',
    receivedBubble: 'bg-cyan-900/40',
    receivedText: 'text-cyan-50',
    preview: 'bg-gradient-to-br from-cyan-500 to-blue-600',
  },
  {
    id: 'sunset',
    name: 'Sunset',
    background: 'bg-gradient-to-b from-orange-950/40 to-background',
    sentBubble: 'bg-gradient-to-br from-orange-500 to-pink-600',
    sentText: 'text-white',
    receivedBubble: 'bg-orange-900/40',
    receivedText: 'text-orange-50',
    preview: 'bg-gradient-to-br from-orange-500 to-pink-600',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    background: 'bg-gradient-to-b from-indigo-950/60 to-background',
    sentBubble: 'bg-gradient-to-br from-indigo-600 to-slate-800',
    sentText: 'text-white',
    receivedBubble: 'bg-indigo-950/60',
    receivedText: 'text-indigo-100',
    preview: 'bg-gradient-to-br from-indigo-600 to-slate-800',
  },
  {
    id: 'carbon',
    name: 'Carbon',
    background: 'bg-gradient-to-b from-neutral-900 to-background',
    sentBubble: 'bg-gradient-to-br from-neutral-600 to-neutral-800',
    sentText: 'text-white',
    receivedBubble: 'bg-neutral-800/80',
    receivedText: 'text-neutral-100',
    preview: 'bg-gradient-to-br from-neutral-600 to-neutral-800',
  },
  {
    id: 'rose',
    name: 'Rose',
    background: 'bg-gradient-to-b from-rose-950/40 to-background',
    sentBubble: 'bg-gradient-to-br from-rose-500 to-pink-600',
    sentText: 'text-white',
    receivedBubble: 'bg-rose-900/40',
    receivedText: 'text-rose-50',
    preview: 'bg-gradient-to-br from-rose-500 to-pink-600',
  },
  {
    id: 'emerald',
    name: 'Emerald',
    background: 'bg-gradient-to-b from-emerald-950/40 to-background',
    sentBubble: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    sentText: 'text-white',
    receivedBubble: 'bg-emerald-900/40',
    receivedText: 'text-emerald-50',
    preview: 'bg-gradient-to-br from-emerald-500 to-teal-600',
  },
];

export const getThemeById = (id: string): ChatTheme => {
  return chatThemes.find(t => t.id === id) || chatThemes[0];
};
