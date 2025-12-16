-- Drop existing RLS policies with trailing spaces
DROP POLICY IF EXISTS "Users can view participants in their conversations " ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants " ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view their conversations " ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations " ON public.conversations;

-- Also try without trailing spaces
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can add participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;

-- Create a security definer function to check conversation membership
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
  )
$$;

-- Recreate conversation_participants policies
CREATE POLICY "view_conversation_participants" ON public.conversation_participants
FOR SELECT USING (
  public.is_conversation_member(conversation_id, auth.uid())
);

CREATE POLICY "add_conversation_participants" ON public.conversation_participants
FOR INSERT WITH CHECK (
  user_id = auth.uid() OR public.is_conversation_member(conversation_id, auth.uid())
);

-- Recreate conversations policies
CREATE POLICY "view_own_conversations" ON public.conversations
FOR SELECT USING (
  public.is_conversation_member(id, auth.uid())
);

CREATE POLICY "create_conversations" ON public.conversations
FOR INSERT WITH CHECK (true);

-- Add UPDATE policy for conversations (needed to update updated_at)
CREATE POLICY "update_own_conversations" ON public.conversations
FOR UPDATE USING (
  public.is_conversation_member(id, auth.uid())
);

-- Create storage bucket for story media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('story-media', 'story-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for story-media bucket
CREATE POLICY "Anyone can view story media"
ON storage.objects FOR SELECT
USING (bucket_id = 'story-media');

CREATE POLICY "Users can upload story media"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'story-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own story media"
ON storage.objects FOR DELETE
USING (bucket_id = 'story-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Add media_type column to stories table
ALTER TABLE public.stories ADD COLUMN IF NOT EXISTS media_type text DEFAULT 'image';