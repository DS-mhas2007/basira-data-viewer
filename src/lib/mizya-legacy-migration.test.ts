import { describe, expect, it } from "vitest";
import type { WorkspaceSession } from "@/lib/workspace-store";
import { legacySessionToManifest } from "./mizya-legacy-migration";

const session: WorkspaceSession = {
  version: 1,
  savedAt: 123,
  file: {
    fileName: "cohort.xlsx",
    fileSize: 4096,
    sheetNames: ["Patients", "Visits"],
    sheets: {
      Patients: { columns: ["patient_id", "age"], rows: [{ patient_id: "P1", age: 40 }] },
      Visits: { columns: ["patient_id", "date"], rows: [{ patient_id: "P1", date: "2026-01-01" }] },
    },
  },
  sheet: "Patients",
  cleanSteps: [],
  pinned: [],
};

describe("Basira legacy session migration", () => {
  it("creates one project source with a descriptor for every sheet", () => {
    const manifest = legacySessionToManifest(session, "ws_personal", 500);
    expect(manifest.project.workspaceId).toBe("ws_personal");
    expect(manifest.sources).toHaveLength(1);
    expect(manifest.sources[0]?.kind).toBe("xlsx");
    expect(manifest.sources[0]?.status).toBe("needs-relink");
    expect(manifest.sources[0]?.assets.map((asset) => asset.name)).toEqual(["Patients", "Visits"]);
    expect(manifest.sources[0]?.assets[0]?.columns).toEqual(["patient_id", "age"]);
  });

  it("keeps parsed rows out of the new project manifest", () => {
    const manifest = legacySessionToManifest(session, "ws_personal", 500);
    expect(JSON.stringify(manifest)).not.toContain('"patient_id":"P1"');
    expect(manifest.sources[0]?.config.legacySessionKey).toBe("current");
  });
});
