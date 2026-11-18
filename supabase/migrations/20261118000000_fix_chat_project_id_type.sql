-- Normalize project_id to TEXT because MIZYA project IDs are client-generated strings
-- (for example, prj_<uuid>), not PostgreSQL UUID values.
ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS project_id TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'chat_threads'
      AND column_name = 'project_id'
      AND data_type <> 'text'
  ) THEN
    ALTER TABLE public.chat_threads
      ALTER COLUMN project_id TYPE TEXT
      USING project_id::text;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS chat_threads_user_project_updated_idx
  ON public.chat_threads (user_id, project_id, updated_at DESC);

COMMENT ON COLUMN public.chat_threads.project_id IS
  'Client-generated MIZYA project identifier; NULL is reserved for legacy unscoped threads.';