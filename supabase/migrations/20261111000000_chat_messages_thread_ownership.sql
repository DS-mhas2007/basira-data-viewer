-- chat_messages: لا يكفي أن user_id = auth.uid(). يجب أن يكون thread_id ملكاً للمستخدم أيضاً،
-- وإلا أمكن إدراج رسائل في محادثة مستخدم آخر إن عُرف معرّفها.
DROP POLICY IF EXISTS "own messages" ON public.chat_messages;

CREATE POLICY "own messages" ON public.chat_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.chat_threads t
      WHERE t.id = thread_id AND t.user_id = auth.uid()
    )
  );

-- حدود حجم معقولة لمنع تخزين حمولات ضخمة (NOT VALID: تُطبَّق على الصفوف الجديدة فقط ولا تفشل بسبب بيانات قديمة)
ALTER TABLE public.chat_threads
  ADD CONSTRAINT chat_threads_title_len CHECK (char_length(title) <= 200) NOT VALID;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chat_messages_parts_size CHECK (pg_column_size(parts) <= 1000000) NOT VALID;
