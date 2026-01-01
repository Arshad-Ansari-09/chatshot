-- Add visibility column to stories table
ALTER TABLE public.stories 
ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'world' 
CHECK (visibility IN ('world', 'friends'));