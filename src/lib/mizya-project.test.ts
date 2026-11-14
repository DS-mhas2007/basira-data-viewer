import { describe, expect, it } from "vitest";
import {
  createDataSource,
  createProject,
  createProjectManifest,
  validateProjectManifest,
} from "./mizya-project";

describe("MIZYA project domain", () => {
  it("creates a normalized project with stable schema metadata", () => {
    const project = createProject("ws_personal", "  Sales  ", "  Quarterly review  ", 100);
    expect(project.name).toBe("Sales");
    expect(project.description).toBe("Quarterly review");
    expect(project.createdAt).toBe(100);
    expect(project.schemaVersion).toBe(1);
    expect(project.sourceIds).toEqual([]);
  });

  it("creates local-file sources as requiring relink and keeps only descriptors", () => {
    const source = createDataSource("prj_1", {
      kind: "csv",
      name: "Sales.csv",
      file: { fileName: "Sales.csv", fileSize: 2048 },
    }, 200);
    expect(source.status).toBe("needs-relink");
    expect(source.execution).toBe("browser");
    expect(source.file?.fileName).toBe("Sales.csv");
    expect("bytes" in source).toBe(false);
  });

  it("builds a manifest whose source ids match its source records", () => {
    const project = createProject("ws_1", "Research", "", 10);
    const source = createDataSource(project.id, { kind: "xlsx", name: "Cohort.xlsx" }, 20);
    const manifest = createProjectManifest(project, [source]);
    expect(manifest.project.sourceIds).toEqual([source.id]);
    expect(validateProjectManifest(manifest)).toBe(true);
  });

  it("rejects cross-project and duplicate sources", () => {
    const project = createProject("ws_1", "Research", "", 10);
    const foreign = createDataSource("another-project", { kind: "csv", name: "other.csv" }, 20);
    expect(() => createProjectManifest(project, [foreign])).toThrow("source-project-mismatch");
    const source = createDataSource(project.id, { kind: "csv", name: "data.csv" }, 20);
    expect(() => createProjectManifest(project, [source, source])).toThrow("duplicate-source-id");
  });

  it("rejects manifests with missing source references", () => {
    const project = createProject("ws_1", "Research", "", 10);
    const source = createDataSource(project.id, { kind: "csv", name: "data.csv" }, 20);
    const manifest = createProjectManifest(project, [source]);
    manifest.project.sourceIds = ["missing"];
    expect(validateProjectManifest(manifest)).toBe(false);
  });

  it("rejects manifests with unsupported schema versions", () => {
    const project = createProject("ws_1", "Research", "", 10);
    const manifest = createProjectManifest(project);
    expect(validateProjectManifest({ ...manifest, schemaVersion: 999 })).toBe(false);
  });

  it("rejects raw credentials embedded in source config", () => {
    const project = createProject("ws_1", "Research", "", 10);
    const source = createDataSource(project.id, {
      kind: "postgres",
      name: "Clinical DB",
      config: { host: "db.example", apiKey: "must-not-be-stored" },
    }, 20);
    expect(validateProjectManifest(createProjectManifest(project, [source]))).toBe(false);
  });
});
