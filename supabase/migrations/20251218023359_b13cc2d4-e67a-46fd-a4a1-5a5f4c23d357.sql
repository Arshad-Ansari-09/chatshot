-- Drop existing update policy
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;

-- Create new policy that allows users to:
-- 1. Update their own messages (edit content)
-- 2. Mark messages as read in conversations they're part of
CREATE POLICY "Users can update messages in their conversations" 
ON public.messages 
FOR UPDATE 
USING (
  (is_world_chat(conversation_id) OR is_conversation_member(conversation_id, auth.uid()))
)
WITH CHECK (
  -- Can only update is_read for others' messages, or full update for own messages
  (sender_id = auth.uid()) OR 
  (sender_id != auth.uid() AND is_conversation_member(conversation_id, auth.uid()))
);