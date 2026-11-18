import { describe, expect, it } from "vitest";
import { createDataSource, createProject, createProjectManifest } from "./mizya-project";
import { getProjectSyncFootprint } from "./mizya-project-sync";

describe("MIZYA cloud project sync boundary", () => {
  it("exposes identity and source count without exposing local data payloads", () => {
    const project = createProject("ws_personal_local_v1", "Research", "", 100);
    const source = createDataSource(project.id, {
      kind: "csv",
      name: "cohort.csv",
      file: { fileName: "cohort.csv", fileSize: 1024 },
      assets: [{ id: "table_1", name: "cohort", assetType: "table", columns: ["age"] }],
    }, 110);
    expect(getProjectSyncFootprint(createProjectManifest(project, [source]))).toEqual({
      localProjectId: project.id,
      sourceCount: 1,
      includesRawFileBytes: false,
      includesDatasetRows: false,
      includesQueryResults: false,
      includesCredentials: false,
    });
  });
});
