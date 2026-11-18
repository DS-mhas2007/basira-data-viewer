import { describe, expect, it } from "vitest";
import { createProject, createProjectManifest } from "@/lib/mizya-project";
import { CloudProjectSyncError } from "@/lib/mizya-cloud-project-repository";
import {
  classifyProjectSyncError,
  getProjectManifestFingerprint,
  getProjectSyncRetryDelayMs,
} from "@/lib/mizya-sync-queue";

describe("MIZYA durable project sync queue policy", () => {
  it("fingerprints the manifest deterministically without changing it", () => {
    const manifest = createProjectManifest(createProject("ws_personal_local_v1", "Research", "", 10));
    const before = structuredClone(manifest);
    expect(getProjectManifestFingerprint(manifest)).toBe(getProjectManifestFingerprint(manifest));
    expect(manifest).toEqual(before);
    expect(getProjectManifestFingerprint({
      ...manifest,
      project: { ...manifest.project, description: "updated" },
    })).not.toBe(getProjectManifestFingerprint(manifest));
  });

  it("uses capped exponential retry delays", () => {
    expect(getProjectSyncRetryDelayMs(0)).toBe(1_000);
    expect(getProjectSyncRetryDelayMs(1)).toBe(2_000);
    expect(getProjectSyncRetryDelayMs(2)).toBe(4_000);
    expect(getProjectSyncRetryDelayMs(99)).toBe(5 * 60_000);
  });

  it("blocks authentication and revision conflicts instead of retrying blindly", () => {
    expect(classifyProjectSyncError(new Error("cloud-auth-required"))).toBe("auth");
    expect(classifyProjectSyncError(new Error("cloud-project-revision-conflict"))).toBe("conflict");
    expect(classifyProjectSyncError(new Error("cloud-source-tombstoned:src_1"))).toBe("conflict");
    expect(classifyProjectSyncError(new Error("cloud-sync-owner-mismatch"))).toBe("owner");
    expect(classifyProjectSyncError(new Error("network connection lost"))).toBeNull();
  });

  it("retains the revision known to have committed before a source-stage failure", () => {
    const error = new CloudProjectSyncError(new Error("network connection lost"), {
      cloudProjectId: "cloud-project-1",
      workspaceId: "cloud-workspace-1",
      revision: 7,
    });
    expect(error.phase).toBe("sources");
    expect(error.cloudProjectId).toBe("cloud-project-1");
    expect(error.workspaceId).toBe("cloud-workspace-1");
    expect(error.revision).toBe(7);
    expect(classifyProjectSyncError(error)).toBeNull();
  });
});
