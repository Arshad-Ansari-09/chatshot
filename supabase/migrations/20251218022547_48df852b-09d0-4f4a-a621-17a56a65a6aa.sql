-- Add media columns to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT;

-- Create chat_media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policy: Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-media');

-- RLS policy: Allow anyone to view chat media (public bucket)
CREATE POLICY "Anyone can view chat media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'chat-media');

-- RLS policy: Allow users to delete their own uploads
CREATE POLICY "Users can delete own chat media"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);