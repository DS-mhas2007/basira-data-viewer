-- Keep AI conversations isolated inside each browser-local MIZYA project.
-- NULL remains the legacy, unscoped conversation bucket.
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS project_id TEXT;

CREATE INDEX IF NOT EXISTS chat_threads_user_project_updated_idx
  ON public.chat_threads (user_id, project_id, updated_at DESC);

COMMENT ON COLUMN public.chat_threads.project_id IS
  'Client-generated MIZYA project identifier; NULL is reserved for legacy unscoped threads.';