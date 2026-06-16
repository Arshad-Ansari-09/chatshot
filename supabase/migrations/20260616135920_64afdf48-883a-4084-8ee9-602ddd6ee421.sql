
REVOKE EXECUTE ON FUNCTION public.is_world_chat(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.shares_conversation_with(uuid, uuid) FROM PUBLIC, anon;

DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
