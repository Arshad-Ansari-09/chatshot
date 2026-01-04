-- Add theme column to conversations table
ALTER TABLE public.conversations 
ADD COLUMN theme text NOT NULL DEFAULT 'default';

-- Enable realtime for conversations table to sync theme changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;