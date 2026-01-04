-- Add deleted_at column for soft deletes
ALTER TABLE public.messages 
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Add reply_to_id column for message replies
ALTER TABLE public.messages 
ADD COLUMN reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL DEFAULT NULL;

-- Create message_reactions table
CREATE TABLE public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

-- Enable RLS on message_reactions
ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view reactions on messages they can see
CREATE POLICY "Users can view reactions on accessible messages"
ON public.message_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id
    AND (is_world_chat(m.conversation_id) OR is_conversation_member(m.conversation_id, auth.uid()))
  )
);

-- RLS: Users can add reactions to messages they can see
CREATE POLICY "Users can add reactions"
ON public.message_reactions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id
    AND (is_world_chat(m.conversation_id) OR is_conversation_member(m.conversation_id, auth.uid()))
  )
);

-- RLS: Users can remove their own reactions
CREATE POLICY "Users can remove own reactions"
ON public.message_reactions
FOR DELETE
USING (user_id = auth.uid());

-- Enable realtime for message_reactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;