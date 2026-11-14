/**
 * Backward-compatible bridge from Basira's single current session to a MIZYA project manifest.
 * The original session remains untouched in the Basira IndexedDB database.
 */
import type { WorkspaceSession } from "@/lib/workspace-store";
import {
  createDataSource,
  createProject,
  createProjectManifest,
  type ProjectManifest,
  type ProjectRepository,
} from "@/lib/mizya-project";
import { loadSession } from "@/lib/workspace-store";

function sourceKind(fileName: string): "csv" | "xlsx" | "other" {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (extension === "csv") return "csv";
  if (extension === "xlsx") return "xlsx";
  return "other";
}

export function legacySessionToManifest(
  session: WorkspaceSession,
  workspaceId: string,
  now = Date.now(),
): ProjectManifest {
  const project = createProject(
    workspaceId,
    session.file.fileName.replace(/\.[^.]+$/, "") || "مشروع بصيرة",
    "تم استيراده من جلسة بصيرة القديمة",
    now,
  );
  const source = createDataSource(project.id, {
    kind: sourceKind(session.file.fileName),
    name: session.file.fileName,
    config: { legacySessionKey: "current", legacySessionVersion: session.version },
    file: { fileName: session.file.fileName, fileSize: session.file.fileSize },
    assets: session.file.sheetNames.map((sheetName) => ({
      id: sheetName,
      name: sheetName,
      assetType: "sheet" as const,
      columns: session.file.sheets[sheetName]?.columns ?? [],
    })),
  }, now);
  // The old session still owns the parsed rows. Keep this descriptor pending until the
  // restore adapter reconnects it to DuckDB; do not duplicate the dataset in this manifest.
  source.status = "pending";
  return createProjectManifest(project, [source]);
}

/**
 * Imports the existing single-file session once per workspace.
 * Returns null when there is no old session or a matching import already exists.
 */
export async function migrateLegacySession(
  repository: ProjectRepository,
  workspaceId: string,
): Promise<ProjectManifest | null> {
  const session = await loadSession();
  if (!session) return null;

  const existing = await repository.listProjects(workspaceId);
  for (const project of existing) {
    const manifest = await repository.getProject(project.id);
    if (manifest?.sources.some((source) => source.config["legacySessionKey"] === "current")) {
      return null;
    }
  }

  const manifest = legacySessionToManifest(session, workspaceId);
  await repository.saveProject(manifest);
  return manifest;
}
