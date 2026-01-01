-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

-- Conversations: allow authenticated users to INSERT (create) conversations
DROP POLICY IF EXISTS "create_conversations" ON public.conversations;
CREATE POLICY "Authenticated users can create conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Conversation participants: ensure authenticated users can add themselves or add others once they are a member
DROP POLICY IF EXISTS "add_conversation_participants" ON public.conversation_participants;
CREATE POLICY "Authenticated users can add conversation participants"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK ((user_id = auth.uid()) OR public.is_conversation_member(conversation_id, auth.uid()));

-- (Optional hardening) require auth for viewing participants
DROP POLICY IF EXISTS "view_conversation_participants" ON public.conversation_participants;
CREATE POLICY "Authenticated users can view conversation participants"
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (public.is_conversation_member(conversation_id, auth.uid()));

-- Atomic create-or-get for 1:1 chats (transactional)
CREATE OR REPLACE FUNCTION public.get_or_create_private_conversation(_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _self uuid := auth.uid();
  _conversation_id uuid;
  _a text;
  _b text;
BEGIN
  IF _self IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Prevent duplicates under concurrency (locks per user-pair for the duration of this transaction)
  _a := LEAST(_self::text, _other_user_id::text);
  _b := GREATEST(_self::text, _other_user_id::text);
  PERFORM pg_advisory_xact_lock(hashtext(_a || ':' || _b));

  SELECT c.id
    INTO _conversation_id
  FROM public.conversations c
  JOIN public.conversation_participants p1
    ON p1.conversation_id = c.id
   AND p1.user_id = _self
  JOIN public.conversation_participants p2
    ON p2.conversation_id = c.id
   AND p2.user_id = _other_user_id
  WHERE COALESCE(c.is_group, false) = false
    AND NOT public.is_world_chat(c.id)
  LIMIT 1;

  IF _conversation_id IS NOT NULL THEN
    RETURN _conversation_id;
  END IF;

  _conversation_id := gen_random_uuid();

  INSERT INTO public.conversations (id, is_group)
  VALUES (_conversation_id, false);

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (_conversation_id, _self),
         (_conversation_id, _other_user_id);

  RETURN _conversation_id;
END;
$$;

-- Allow calling the RPC from the client
REVOKE EXECUTE ON FUNCTION public.get_or_create_private_conversation(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_private_conversation(uuid) TO authenticated;
