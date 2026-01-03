-- Create a security definer function to check if two users share a conversation
CREATE OR REPLACE FUNCTION public.shares_conversation_with(_viewer_id uuid, _profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp1
    JOIN public.conversation_participants cp2 
      ON cp1.conversation_id = cp2.conversation_id
    WHERE cp1.user_id = _viewer_id
      AND cp2.user_id = _profile_id
  )
$$;

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- Create a new restrictive policy that allows:
-- 1. Users to view their own profile
-- 2. Users to view profiles of people they share a conversation with
CREATE POLICY "Users can view own and conversation members profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid() 
  OR public.shares_conversation_with(auth.uid(), id)
);

-- Create a separate policy for search functionality
-- This allows searching by username but only returns minimal info needed for search
-- Note: The actual field restriction happens in the application query
CREATE POLICY "Users can search profiles by username"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Wait, that would be the same issue. Let me think differently.
-- Actually, we need to keep the restrictive policy and handle search via the shares_conversation function
-- OR we create an RPC function for search that uses security definer

-- Let me drop that and create an RPC instead
DROP POLICY IF EXISTS "Users can search profiles by username" ON public.profiles;