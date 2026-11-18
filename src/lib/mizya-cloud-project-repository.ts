import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { validateProjectManifest, type ProjectManifest } from "@/lib/mizya-project";

type CloudClient = SupabaseClient;
function getClient(): CloudClient {
  return supabase as unknown as CloudClient;
}

export interface CloudProjectIdentity {
  id: string;
  workspaceId: string;
  localProjectId: string;
}

/** Creates or returns the authenticated user's single personal cloud workspace. */
export async function ensurePersonalCloudWorkspace(
  client: CloudClient = getClient(),
  name = "مساحتي الشخصية",
): Promise<string> {
  const { data: authData, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!authData.user) throw new Error("cloud-auth-required");

  const { data, error } = await client.from("workspaces")
    .upsert(
      { owner_id: authData.user.id, kind: "personal", name, updated_at: new Date().toISOString() },
      { onConflict: "owner_id,kind" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/**
 * Idempotently syncs project/source descriptors. Raw files, rows, query results,
 * credentials and DuckDB contents are deliberately excluded.
 */
export async function syncProjectManifestToCloud(
  manifest: ProjectManifest,
  client: CloudClient = getClient(),
): Promise<CloudProjectIdentity> {
  if (!validateProjectManifest(manifest)) throw new Error("project-manifest-invalid");
  const workspaceId = await ensurePersonalCloudWorkspace(client);
  const project = manifest.project;

  const { data: cloudProject, error: projectError } = await client.from("projects")
    .upsert({
      workspace_id: workspaceId,
      local_project_id: project.id,
      name: project.name,
      description: project.description,
      schema_version: project.schemaVersion,
      archived_at: project.archivedAt === null ? null : new Date(project.archivedAt).toISOString(),
      created_at: new Date(project.createdAt).toISOString(),
      updated_at: new Date(project.updatedAt).toISOString(),
    }, { onConflict: "workspace_id,local_project_id" })
    .select("id")
    .single();
  if (projectError) throw projectError;

  if (manifest.sources.length) {
    const rows = manifest.sources.map((source) => ({
      project_id: cloudProject.id,
      local_source_id: source.id,
      kind: source.kind,
      name: source.name,
      status: source.status,
      execution: source.execution,
      config: source.config,
      file_metadata: source.file ?? null,
      assets: source.assets,
      schema_version: source.schemaVersion,
      created_at: new Date(source.createdAt).toISOString(),
      updated_at: new Date(source.updatedAt).toISOString(),
    }));
    const { error } = await client.from("project_sources")
      .upsert(rows, { onConflict: "project_id,local_source_id" });
    if (error) throw error;
  }

  return { id: cloudProject.id as string, workspaceId, localProjectId: project.id };
}

/** Attach a thread without changing its legacy local project_id value. */
export async function attachThreadToCloudProject(
  threadId: string,
  cloudProjectId: string,
  client: CloudClient = getClient(),
): Promise<void> {
  const { data, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  if (!data.user) throw new Error("cloud-auth-required");
  const { error } = await client.from("chat_threads")
    .update({ cloud_project_id: cloudProjectId })
    .eq("id", threadId)
    .eq("user_id", data.user.id);
  if (error) throw error;
}
