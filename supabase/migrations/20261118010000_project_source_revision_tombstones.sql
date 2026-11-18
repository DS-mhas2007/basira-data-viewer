-- MIZYA Sprint 2.1: safe source deletion and optimistic concurrency.
-- Existing rows start at revision 1; no project/source payload is rewritten.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_revision_positive CHECK (revision > 0);

ALTER TABLE public.project_sources
  ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.project_sources
  ADD CONSTRAINT project_sources_revision_positive CHECK (revision > 0);

CREATE INDEX IF NOT EXISTS project_sources_active_project_idx
  ON public.project_sources (project_id, updated_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.projects.revision IS
  'Monotonic optimistic-concurrency revision. Increment with compare-and-swap updates.';
COMMENT ON COLUMN public.project_sources.revision IS
  'Monotonic source descriptor revision. Increment with compare-and-swap updates.';
COMMENT ON COLUMN public.project_sources.deleted_at IS
  'Soft-delete tombstone; retained to prevent stale clients from silently recreating a removed source.';
