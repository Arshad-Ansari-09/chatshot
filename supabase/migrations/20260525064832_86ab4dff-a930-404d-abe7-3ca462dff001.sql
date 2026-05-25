CREATE POLICY "Users can leave own conversations"
ON public.conversation_participants
FOR DELETE
TO authenticated
USING (user_id = auth.uid());