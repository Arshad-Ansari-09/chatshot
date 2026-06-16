
-- 1. Messages: split update policies
DROP POLICY IF EXISTS "Users can update messages in their conversations" ON public.messages;

CREATE POLICY "Senders can update own messages"
ON public.messages
FOR UPDATE
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- SECURITY DEFINER function for marking messages as read (recipients only)
CREATE OR REPLACE FUNCTION public.mark_messages_read(_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_world_chat(_conversation_id) OR public.is_conversation_member(_conversation_id, auth.uid())) THEN
    RETURN;
  END IF;

  UPDATE public.messages
  SET is_read = true
  WHERE conversation_id = _conversation_id
    AND sender_id <> auth.uid()
    AND is_read = false;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_messages_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid) TO authenticated;

-- 2. Conversation participants: only insert self
DROP POLICY IF EXISTS "Authenticated users can add conversation participants" ON public.conversation_participants;

CREATE POLICY "Users can add themselves to conversations"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 3. Story views: only story owner or viewer themselves
DROP POLICY IF EXISTS "Authenticated users can view story views" ON public.story_views;

CREATE POLICY "Owner or viewer can read story views"
ON public.story_views
FOR SELECT
TO authenticated
USING (
  viewer_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.stories s
    WHERE s.id = story_views.story_id AND s.user_id = auth.uid()
  )
);

-- 4. Stories: enforce visibility
DROP POLICY IF EXISTS "Authenticated users can view all stories" ON public.stories;

CREATE POLICY "Users can view public or own stories"
ON public.stories
FOR SELECT
TO authenticated
USING (visibility = 'world' OR user_id = auth.uid());

-- 5. Chat-media bucket: require path ownership on insert
DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;

CREATE POLICY "Users can upload chat media to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-media'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 6. Remove broad SELECT (listing) on public buckets; public URLs still work
DROP POLICY IF EXISTS "Anyone can view chat media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view story media" ON storage.objects;
