-- Cloud identity for the existing browser-local MIZYA workspace model.
-- Raw files, DuckDB tables and query result payloads remain browser-local.
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'personal' CHECK (kind = 'personal'),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, kind)
);
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  local_project_id TEXT NOT NULL CHECK (char_length(trim(local_project_id)) BETWEEN 1 AND 160),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
  description TEXT NOT NULL DEFAULT '',
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, local_project_id),
  UNIQUE (id, workspace_id)
);
CREATE TABLE IF NOT EXISTS public.project_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  local_source_id TEXT NOT NULL CHECK (char_length(trim(local_source_id)) BETWEEN 1 AND 160),
  kind TEXT NOT NULL,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'needs-relink', 'error')),
  execution TEXT NOT NULL CHECK (execution IN ('browser', 'server', 'remote')),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  file_metadata JSONB,
  assets JSONB NOT NULL DEFAULT '[]'::jsonb,
  schema_version INTEGER NOT NULL DEFAULT 1 CHECK (schema_version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, local_source_id),
  CHECK (jsonb_typeof(config) = 'object'),
  CHECK (jsonb_typeof(assets) = 'array'),
  CHECK (config::text !~* '(password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|private[_-]?key)')
);
CREATE INDEX IF NOT EXISTS projects_workspace_updated_idx ON public.projects (workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS project_sources_project_idx ON public.project_sources (project_id);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_sources ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_sources TO authenticated;
GRANT ALL ON public.workspaces, public.projects, public.project_sources TO service_role;
DROP POLICY IF EXISTS "owner manages personal workspace" ON public.workspaces;
CREATE POLICY "owner manages personal workspace" ON public.workspaces FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "workspace owner manages projects" ON public.projects;
CREATE POLICY "workspace owner manages projects" ON public.projects FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));
DROP POLICY IF EXISTS "project owner manages source descriptors" ON public.project_sources;
CREATE POLICY "project owner manages source descriptors" ON public.project_sources FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.workspaces w ON w.id = p.workspace_id
    WHERE p.id = project_id AND w.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.projects p JOIN public.workspaces w ON w.id = p.workspace_id
    WHERE p.id = project_id AND w.owner_id = auth.uid()
  ));
-- Keep legacy project_id (client-generated TEXT); NULL cloud_project_id preserves old threads.
ALTER TABLE public.chat_threads ADD COLUMN IF NOT EXISTS cloud_project_id UUID
  REFERENCES public.projects(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS chat_threads_user_cloud_project_updated_idx
  ON public.chat_threads (user_id, cloud_project_id, updated_at DESC);
DROP POLICY IF EXISTS "own threads" ON public.chat_threads;
CREATE POLICY "own threads" ON public.chat_threads FOR ALL TO authenticated
  USING (
    auth.uid() = user_id AND (
      cloud_project_id IS NULL OR EXISTS (
        SELECT 1 FROM public.projects p JOIN public.workspaces w ON w.id = p.workspace_id
        WHERE p.id = cloud_project_id AND w.owner_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    auth.uid() = user_id AND (
      cloud_project_id IS NULL OR EXISTS (
        SELECT 1 FROM public.projects p JOIN public.workspaces w ON w.id = p.workspace_id
        WHERE p.id = cloud_project_id AND w.owner_id = auth.uid()
      )
    )
  );
COMMENT ON TABLE public.workspaces IS 'Personal cloud workspace identity; schema permits future membership expansion.';
COMMENT ON TABLE public.projects IS 'Cloud project identity and metadata; local_project_id preserves browser-local identity.';
COMMENT ON TABLE public.project_sources IS 'Non-secret source descriptors only; raw files and dataset rows remain local.';
COMMENT ON COLUMN public.chat_threads.project_id IS 'Legacy browser-local project identifier; retained for backward compatibility.';
COMMENT ON COLUMN public.chat_threads.cloud_project_id IS 'Authoritative cloud project FK, constrained by owner-based RLS.';
