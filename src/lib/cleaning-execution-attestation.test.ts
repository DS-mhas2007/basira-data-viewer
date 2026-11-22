import { beforeEach, describe, expect, it } from "vitest";
import {
  clearCleaningExecutionAttestation,
  compareCleaningExecutionAttestation,
  getCleaningExecutionAttestation,
  recordCleaningExecutionAttestation,
} from "./cleaning-execution-attestation";
import type { CleanStep } from "./cleaning";

const source = {
  alias: "sales__Sheet1",
  contentFingerprint: `content-v1:sha256:${"a".repeat(64)}`,
  sourceRevision: 1,
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

describe("cleaning execution attestation", () => {
  beforeEach(() => clearCleaningExecutionAttestation());

  it("records proof only after a valid source, recipe and output are supplied", async () => {
    const proof = await recordCleaningExecutionAttestation({
      source,
      steps,
      outputFingerprint,
    });

    expect(proof?.version).toBe("execution-v1");
    expect(proof?.sourceAlias).toBe(source.alias);
    expect(getCleaningExecutionAttestation()?.outputFingerprint).toBe(outputFingerprint);
  });

  it("aligns only when the active source, declared recipe and output still match", async () => {
    await recordCleaningExecutionAttestation({ source, steps, outputFingerprint });

    await expect(compareCleaningExecutionAttestation({
      source,
      steps,
      outputFingerprint,
    })).resolves.toMatchObject({ status: "aligned" });
  });

  it("rejects a recipe that was declared but not successfully re-applied", async () => {
    await recordCleaningExecutionAttestation({ source, steps, outputFingerprint });

    await expect(compareCleaningExecutionAttestation({
      source,
      steps: [],
      outputFingerprint,
    })).resolves.toMatchObject({ status: "mismatch" });
  });

  it("rejects source switches, source reactivation and output drift", async () => {
    await recordCleaningExecutionAttestation({ source, steps, outputFingerprint });

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
    });
    expect(invalid).toBeNull();
    expect(getCleaningExecutionAttestation()).toBeNull();
  });
});
