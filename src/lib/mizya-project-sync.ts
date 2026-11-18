import type { ProjectManifest } from "@/lib/mizya-project";

/** A deliberately narrow, deterministic summary of what project sync is allowed to upload. */
export function getProjectSyncFootprint(manifest: ProjectManifest) {
  return {
    localProjectId: manifest.project.id,
    sourceCount: manifest.sources.length,
    includesRawFileBytes: false as const,
    includesDatasetRows: false as const,
    includesQueryResults: false as const,
    includesCredentials: false as const,
  };
}

export interface CloudSourceRevision {
  localSourceId: string;
  revision: number;
  deletedAt: string | null;
}

export interface SourceSyncPlan {
  upsert: string[];
  tombstone: string[];
  rejectResurrection: string[];
}

/** Computes a deterministic sync plan without mutating the manifest or cloud state. */
export function buildSourceSyncPlan(
  localSourceIds: readonly string[],
  cloudSources: readonly CloudSourceRevision[],
): SourceSyncPlan {
  const local = new Set(localSourceIds);
  const cloud = new Map(cloudSources.map((source) => [source.localSourceId, source]));
  const upsert = [...local].filter((id) => {
    const existing = cloud.get(id);
    return !existing || existing.deletedAt === null;
  }).sort();
  const tombstone = cloudSources
    .filter((source) => source.deletedAt === null && !local.has(source.localSourceId))
    .map((source) => source.localSourceId)
    .sort();
  const rejectResurrection = [...local]
    .filter((id) => cloud.has(id) && cloud.get(id)?.deletedAt !== null)
    .sort();
  return { upsert, tombstone, rejectResurrection };
}

/** Requires an explicit revision token for every update to an existing project. */
export function assertExpectedRevision(expected: number | undefined, actual: number): void {
  if (expected === undefined) throw new Error("cloud-project-revision-required");
  if (!Number.isSafeInteger(expected) || expected < 0 || expected !== actual) {
    throw new Error("cloud-project-revision-conflict");
  }
}
