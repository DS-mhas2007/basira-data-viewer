import {
  createProject,
  createProjectManifest,
  type MizyaProject,
  type ProjectRepository,
} from "@/lib/mizya-project";
import { indexedDbProjectRepository } from "@/lib/mizya-project-repository";
import { migrateLegacySession } from "@/lib/mizya-legacy-migration";
import { loadProjectSession, loadSession, saveProjectSession } from "@/lib/workspace-store";

export const PERSONAL_WORKSPACE_ID = "ws_personal_local_v1";
export const PERSONAL_WORKSPACE_NAME = "مساحتي الشخصية";

/**
 * Ensures a local personal workspace has at least one project.
 * Legacy Basira session migration runs before the empty starter project is created.
 */
export async function ensurePersonalWorkspace(
  repository: ProjectRepository = indexedDbProjectRepository,
): Promise<MizyaProject[]> {
  await migrateLegacySession(repository, PERSONAL_WORKSPACE_ID);
  let projects = await repository.listProjects(PERSONAL_WORKSPACE_ID);

  // Copy the legacy local snapshot into its migrated project once, without deleting
  // or modifying the original "current" session key.
  const legacySession = await loadSession();
  if (legacySession) {
    for (const project of projects) {
      const manifest = await repository.getProject(project.id);
      const isLegacy = manifest?.sources.some(
        (source) => source.config["legacySessionKey"] === "current",
      );
      if (isLegacy && !(await loadProjectSession(project.id))) {
        await saveProjectSession(project.id, {
          file: legacySession.file,
          sheet: legacySession.sheet,
          cleanSteps: legacySession.cleanSteps,
          pinned: legacySession.pinned,
        });
      }
    }
  }
  if (projects.length === 0) {
    const project = createProject(
      PERSONAL_WORKSPACE_ID,
      "مشروعي الأول",
      "مساحة التحليل الافتراضية في MIZYA",
    );
    await repository.saveProject(createProjectManifest(project));
    projects = await repository.listProjects(PERSONAL_WORKSPACE_ID);
  }
  return projects;
}
