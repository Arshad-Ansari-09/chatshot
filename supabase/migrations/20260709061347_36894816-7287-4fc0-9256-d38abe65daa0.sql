
-- 1. Revoke EXECUTE from anon/public on SECURITY DEFINER helpers
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.shares_conversation_with(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_world_chat(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_messages_read(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.search_users(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_or_create_private_conversation(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_join_world_chat() FROM anon, PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon, PUBLIC, authenticated;

GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.shares_conversation_with(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_world_chat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_private_conversation(uuid) TO authenticated;

-- 2. Restrict conversation_participants INSERT: prevent joining arbitrary conversations.
-- Only allow inserting self into a conversation that has no participants yet (creator seed).
-- All other joins go through SECURITY DEFINER RPC (get_or_create_private_conversation)
-- or the auto_join_world_chat trigger.
DROP POLICY IF EXISTS "Users can add themselves to conversations" ON public.conversation_participants;

CREATE POLICY "Users can seed self into empty conversation"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND NOT EXISTS (
    SELECT 1 FROM public.conversation_participants existing
    WHERE existing.conversation_id = conversation_participants.conversation_id
  )
);

-- 3. Allow senders to delete their own messages
CREATE POLICY "Senders can delete own messages"
ON public.messages
FOR DELETE
TO authenticated
USING (sender_id = auth.uid());
