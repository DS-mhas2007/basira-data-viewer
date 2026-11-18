import { describe, expect, it } from "vitest";
import { createDataSource, createProject, createProjectManifest } from "./mizya-project";
import {
  assertExpectedRevision,
  buildSourceSyncPlan,
  getProjectSyncFootprint,
} from "./mizya-project-sync";

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

  it("creates tombstones for cloud sources missing from the local manifest", () => {
    expect(buildSourceSyncPlan(["src_a"], [
      { localSourceId: "src_a", revision: 2, deletedAt: null },
      { localSourceId: "src_b", revision: 4, deletedAt: null },
    ])).toEqual({ upsert: ["src_a"], tombstone: ["src_b"], rejectResurrection: [] });
  });

  it("never silently resurrects a tombstoned source", () => {
    expect(buildSourceSyncPlan(["src_a"], [
      { localSourceId: "src_a", revision: 3, deletedAt: "2026-11-18T10:00:00.000Z" },
    ])).toEqual({ upsert: [], tombstone: [], rejectResurrection: ["src_a"] });
  });

  it("requires an exact project revision before updating an existing cloud project", () => {
    expect(() => assertExpectedRevision(undefined, 3)).toThrow("cloud-project-revision-required");
    expect(() => assertExpectedRevision(2, 3)).toThrow("cloud-project-revision-conflict");
    expect(() => assertExpectedRevision(3, 3)).not.toThrow();
  });
});
