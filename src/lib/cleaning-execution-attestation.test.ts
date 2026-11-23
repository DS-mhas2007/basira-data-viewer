import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import {
  clearCleaningExecutionAttestation,
  compareCleaningExecutionAttestation,
  getCleaningExecutionAttestation,
  getCleaningExecutionAttestationGeneration,
  recordCleaningExecutionAttestation,
} from "./cleaning-execution-attestation";
import type { CleanStep } from "./cleaning";

const source = {
  alias: "sales__Sheet1",
  contentFingerprint: `content-v1:sha256:${"a".repeat(64)}`,
  sourceRevision: 1,
  relationRevision: 1,
};
const outputFingerprint = `output-v1:sha256:${"b".repeat(64)}`;
const steps: CleanStep[] = [
  {
    id: "ui-only-id",
    kind: "trim",
    label: "Trim text",
    affectedRows: 3,
    params: { allColumns: ["name"], textColumns: ["name"] },
  },
];


async function recordCurrentAttestation() {
  return recordCleaningExecutionAttestation({
    source,
    steps,
    outputFingerprint,
    expectedGeneration: getCleaningExecutionAttestationGeneration(),
  });
}

describe("cleaning execution attestation", () => {
  beforeEach(() => {
    clearCleaningExecutionAttestation();
    vi.stubGlobal("crypto", webcrypto);
  });
  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("records proof only after a valid source, recipe and output are supplied", async () => {
    const proof = await recordCurrentAttestation();

    expect(proof?.version).toBe("execution-v1");
    expect(proof?.sourceAlias).toBe(source.alias);
    expect(getCleaningExecutionAttestation()?.outputFingerprint).toBe(outputFingerprint);
  });

  it("aligns only when the active source, declared recipe and output still match", async () => {
    await recordCurrentAttestation();

    await expect(compareCleaningExecutionAttestation({
      source,
      steps,
      outputFingerprint,
    })).resolves.toMatchObject({ status: "aligned" });
  });

  it("rejects a recipe that was declared but not successfully re-applied", async () => {
    await recordCurrentAttestation();

    await expect(compareCleaningExecutionAttestation({
      source,
      steps: [],
      outputFingerprint,
    })).resolves.toMatchObject({ status: "mismatch" });
  });

  it("rejects source switches, source reactivation and output drift", async () => {
    await recordCurrentAttestation();

    await expect(compareCleaningExecutionAttestation({
      source: { ...source, alias: "other-sheet" },
      steps,
      outputFingerprint,
    })).resolves.toMatchObject({ status: "mismatch" });

    await expect(compareCleaningExecutionAttestation({
      source: { ...source, sourceRevision: 2 },
      steps,
      outputFingerprint,
    })).resolves.toMatchObject({ status: "mismatch" });

    await expect(compareCleaningExecutionAttestation({
      source,
      steps,
      outputFingerprint: `output-v1:sha256:${"c".repeat(64)}`,
    })).resolves.toMatchObject({ status: "mismatch" });

    await expect(compareCleaningExecutionAttestation({
      source: { ...source, relationRevision: 2 },
      steps,
      outputFingerprint,
    })).resolves.toMatchObject({ status: "mismatch" });
  });

  it("rejects a completed output hash if invalidation occurs before proof recording starts", async () => {
    const expectedGeneration = getCleaningExecutionAttestationGeneration();
    // Models a mutation after output hashing resolves but before record() is invoked.
    clearCleaningExecutionAttestation();
    const proof = await recordCleaningExecutionAttestation({
      source,
      steps,
      outputFingerprint,
      expectedGeneration,
    });
    expect(proof).toBeNull();
    expect(getCleaningExecutionAttestation()).toBeNull();
  });

  it("does not resurrect proof when the source or relation is invalidated during hashing", async () => {
    const pending = recordCurrentAttestation();
    clearCleaningExecutionAttestation();
    await expect(pending).resolves.toBeNull();
    expect(getCleaningExecutionAttestation()).toBeNull();
  });

  it("withholds alignment if evidence is invalidated while the recipe is being checked", async () => {
    await recordCurrentAttestation();
    const pending = compareCleaningExecutionAttestation({ source, steps, outputFingerprint });
    clearCleaningExecutionAttestation();
    await expect(pending).resolves.toMatchObject({ status: "insufficient-evidence" });
  });

  it("withholds alignment when proof or source identity is unavailable", async () => {
    await expect(compareCleaningExecutionAttestation({
      source,
      steps,
      outputFingerprint,
    })).resolves.toMatchObject({ status: "insufficient-evidence" });

    const invalid = await recordCleaningExecutionAttestation({
      source: null,
      steps,
      outputFingerprint,
      expectedGeneration: getCleaningExecutionAttestationGeneration(),
    });
    expect(invalid).toBeNull();
    expect(getCleaningExecutionAttestation()).toBeNull();
  });
});
