-- Create World Chat with fixed UUID
INSERT INTO conversations (id, name, is_group, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'World Chat',
  true,
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

-- Helper function to check if conversation is World Chat
CREATE OR REPLACE FUNCTION public.is_world_chat(conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT conversation_id = '00000000-0000-0000-0000-000000000001'::uuid
$$;

-- Update messages INSERT policy to allow World Chat messages
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
CREATE POLICY "Users can send messages to their conversations" 
ON public.messages 
FOR INSERT 
WITH CHECK (
  (sender_id = auth.uid()) AND (
    is_world_chat(conversation_id) OR 
    is_conversation_member(conversation_id, auth.uid())
  )
);

-- Update messages SELECT policy to allow World Chat messages
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Users can view messages in their conversations" 
ON public.messages 
FOR SELECT 
USING (
  is_world_chat(conversation_id) OR 
  is_conversation_member(conversation_id, auth.uid())
);

-- Update messages UPDATE policy for World Chat
DROP POLICY IF EXISTS "Users can update their own messages" ON public.messages;
CREATE POLICY "Users can update their own messages" 
ON public.messages 
FOR UPDATE 
USING (
  (sender_id = auth.uid()) AND (
    is_world_chat(conversation_id) OR 
    is_conversation_member(conversation_id, auth.uid())
  )
);

-- Update conversations SELECT policy to include World Chat
DROP POLICY IF EXISTS "view_own_conversations" ON public.conversations;
CREATE POLICY "view_own_conversations" 
ON public.conversations 
FOR SELECT 
USING (
  is_world_chat(id) OR 
  is_conversation_member(id, auth.uid())
);

-- Auto-join new users to World Chat
CREATE OR REPLACE FUNCTION public.auto_join_world_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES ('00000000-0000-0000-0000-000000000001', NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger for auto-join on profile creation
DROP TRIGGER IF EXISTS on_profile_created_join_world_chat ON public.profiles;
CREATE TRIGGER on_profile_created_join_world_chat
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.auto_join_world_chat();

-- Add existing users to World Chat
INSERT INTO conversation_participants (conversation_id, user_id)
SELECT '00000000-0000-0000-0000-000000000001', id FROM profiles
ON CONFLICT DO NOTHING;