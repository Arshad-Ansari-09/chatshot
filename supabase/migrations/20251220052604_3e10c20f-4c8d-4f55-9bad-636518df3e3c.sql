-- Fix RLS policy on profiles: require authentication to view profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Fix RLS policy on messages: require authentication for world chat access
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Authenticated users can view messages in their conversations"
ON public.messages
FOR SELECT
TO authenticated
USING (is_world_chat(conversation_id) OR is_conversation_member(conversation_id, auth.uid()));

-- Fix RLS policy on conversations: require authentication for world chat access
DROP POLICY IF EXISTS "view_own_conversations" ON public.conversations;
CREATE POLICY "Authenticated users can view own conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (is_world_chat(id) OR is_conversation_member(id, auth.uid()));

-- Fix story_views: require authentication
DROP POLICY IF EXISTS "Users can view story views" ON public.story_views;
CREATE POLICY "Authenticated users can view story views"
ON public.story_views
FOR SELECT
TO authenticated
USING (true);

-- Fix stories: require authentication to view
DROP POLICY IF EXISTS "Users can view all stories" ON public.stories;
CREATE POLICY "Authenticated users can view all stories"
ON public.stories
FOR SELECT
TO authenticated
USING (true);