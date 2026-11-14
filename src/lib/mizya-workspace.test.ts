import { describe, expect, it, vi } from "vitest";
import { createProject, createProjectManifest, type ProjectManifest, type ProjectRepository } from "./mizya-project";
import { ensurePersonalWorkspace, PERSONAL_WORKSPACE_ID } from "./mizya-workspace";

function memoryRepository(initial: ProjectManifest[] = []): ProjectRepository {
  const records = new Map(initial.map((manifest) => [manifest.project.id, manifest]));
  return {
    async listProjects(workspaceId) {
      return [...records.values()]
        .filter((manifest) => manifest.project.workspaceId === workspaceId)
        .map((manifest) => manifest.project);
    },
    async getProject(id) { return records.get(id) ?? null; },
    async saveProject(manifest) { records.set(manifest.project.id, manifest); },
    async deleteProject(id) { records.delete(id); },
  };
}

describe("MIZYA personal workspace bootstrap", () => {
  it("creates a starter project if there is no legacy session or project", async () => {
    const repository = memoryRepository();
    const projects = await ensurePersonalWorkspace(repository);
    expect(projects).toHaveLength(1);
    expect(projects[0]?.workspaceId).toBe(PERSONAL_WORKSPACE_ID);
    expect(projects[0]?.name).toBe("مشروعي الأول");
  });

  it("does not create duplicate starter projects on repeated bootstrap", async () => {
    const repository = memoryRepository();
    const first = await ensurePersonalWorkspace(repository);
    const second = await ensurePersonalWorkspace(repository);
    expect(second).toHaveLength(1);
    expect(second[0]?.id).toBe(first[0]?.id);
  });

  it("keeps projects from other workspaces isolated", async () => {
    const other = createProject("ws_other", "Other");
    const repository = memoryRepository([createProjectManifest(other)]);
    const projects = await ensurePersonalWorkspace(repository);
    expect(projects.every((project) => project.workspaceId === PERSONAL_WORKSPACE_ID)).toBe(true);
  });
});
