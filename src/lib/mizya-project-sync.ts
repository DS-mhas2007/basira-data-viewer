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
