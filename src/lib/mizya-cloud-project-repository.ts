import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { validateProjectManifest, type ProjectManifest } from "@/lib/mizya-project";
import { assertExpectedRevision, buildSourceSyncPlan } from "@/lib/mizya-project-sync";

type CloudClient = SupabaseClient;
function getClient(): CloudClient {
  return supabase as unknown as CloudClient;
}

export interface CloudProjectIdentity {
  id: string;
  workspaceId: string;
  localProjectId: string;
  revision: number;
}

export class CloudProjectSyncError extends Error {
  readonly phase = "sources" as const;
  readonly cloudProjectId: string;
  readonly workspaceId: string;
  readonly revision: number;
  readonly originalError: unknown;

  constructor(
    cause: unknown,
    identity: { cloudProjectId: string; workspaceId: string; revision: number },
  ) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(message);
    this.name = "CloudProjectSyncError";
    this.cloudProjectId = identity.cloudProjectId;
    this.workspaceId = identity.workspaceId;
    this.revision = identity.revision;
    this.originalError = cause;
  }
}

export interface SyncProjectManifestOptions {
  /** Required when updating an existing cloud project; use the last returned revision. */
  expectedRevision?: number;
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
 * Syncs only project/source descriptors. Existing projects require an explicit
 * revision token; compare-and-swap prevents stale devices from overwriting newer state.
 * Missing sources become tombstones. Tombstoned IDs are never silently resurrected.
 */
export async function syncProjectManifestToCloud(
  manifest: ProjectManifest,
  client: CloudClient = getClient(),
  options: SyncProjectManifestOptions = {},
): Promise<CloudProjectIdentity> {
  if (!validateProjectManifest(manifest)) throw new Error("project-manifest-invalid");
  const workspaceId = await ensurePersonalCloudWorkspace(client);
  const project = manifest.project;

  const { data: existingProject, error: lookupError } = await client.from("projects")
    .select("id,revision")
    .eq("workspace_id", workspaceId)
    .eq("local_project_id", project.id)
    .maybeSingle();
  if (lookupError) throw lookupError;

  let cloudProjectId: string;
  let revision: number;
  const now = new Date().toISOString();

  if (existingProject) {
    assertExpectedRevision(options.expectedRevision, Number(existingProject.revision));
    const { data, error } = await client.from("projects")
      .update({
        name: project.name,
        description: project.description,
        schema_version: project.schemaVersion,
        archived_at: project.archivedAt === null ? null : new Date(project.archivedAt).toISOString(),
        updated_at: now,
        revision: Number(existingProject.revision) + 1,
      })
      .eq("id", existingProject.id)
      .eq("revision", existingProject.revision)
      .select("id,revision")
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("cloud-project-revision-conflict");
    cloudProjectId = data.id as string;
    revision = Number(data.revision);
  } else {
    if (options.expectedRevision !== undefined && options.expectedRevision !== 0) {
      throw new Error("cloud-project-revision-conflict");
    }
    const { data, error } = await client.from("projects")
      .insert({
        workspace_id: workspaceId,
        local_project_id: project.id,
        name: project.name,
        description: project.description,
        schema_version: project.schemaVersion,
        archived_at: project.archivedAt === null ? null : new Date(project.archivedAt).toISOString(),
        created_at: new Date(project.createdAt).toISOString(),
        updated_at: now,
        revision: 1,
      })
      .select("id,revision")
      .single();
    if (error) throw error;
    cloudProjectId = data.id as string;
    revision = Number(data.revision);
  }

  try {
    const { data: existingSources, error: sourceLookupError } = await client.from("project_sources")
      .select("id,local_source_id,revision,deleted_at")
      .eq("project_id", cloudProjectId);
    if (sourceLookupError) throw sourceLookupError;
  
    const plan = buildSourceSyncPlan(
      manifest.sources.map((source) => source.id),
      (existingSources ?? []).map((source) => ({
        localSourceId: source.local_source_id as string,
        revision: Number(source.revision),
        deletedAt: source.deleted_at as string | null,
      })),
    );
    if (plan.rejectResurrection.length) {
      throw new Error(`cloud-source-tombstoned:${plan.rejectResurrection.join(",")}`);
    }
  
    const cloudByLocalId = new Map((existingSources ?? []).map((source) => [source.local_source_id as string, source]));
    for (const source of manifest.sources) {
      const existing = cloudByLocalId.get(source.id);
      const row = {
        kind: source.kind,
        name: source.name,
        status: source.status,
        execution: source.execution,
        config: source.config,
        file_metadata: source.file ?? null,
        assets: source.assets,
        schema_version: source.schemaVersion,
        updated_at: now,
      };
      if (!existing) {
        const { error } = await client.from("project_sources").insert({
          project_id: cloudProjectId,
          local_source_id: source.id,
          ...row,
          created_at: new Date(source.createdAt).toISOString(),
          revision: 1,
          deleted_at: null,
        });
        if (error) throw error;
        continue;
      }
      const { data, error } = await client.from("project_sources")
        .update({ ...row, revision: Number(existing.revision) + 1 })
        .eq("id", existing.id)
        .eq("revision", existing.revision)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`cloud-source-revision-conflict:${source.id}`);
    }
  
    const tombstoneIds = new Set(plan.tombstone);
    for (const source of existingSources ?? []) {
      if (!tombstoneIds.has(source.local_source_id as string)) continue;
      const { data, error } = await client.from("project_sources")
        .update({ deleted_at: now, updated_at: now, revision: Number(source.revision) + 1 })
        .eq("id", source.id)
        .eq("revision", source.revision)
        .is("deleted_at", null)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error(`cloud-source-revision-conflict:${source.local_source_id}`);
    }
  
  
  } catch (error) {
    if (error instanceof CloudProjectSyncError) throw error;
    throw new CloudProjectSyncError(error, {
      cloudProjectId,
      workspaceId,
      revision,
    });
  }

  return { id: cloudProjectId, workspaceId, localProjectId: project.id, revision };
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
  const { data: updatedThread, error } = await client.from("chat_threads")
    .update({ cloud_project_id: cloudProjectId })
    .eq("id", threadId)
    .eq("user_id", data.user.id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!updatedThread) throw new Error("chat-thread-not-found-or-not-owned");
}
