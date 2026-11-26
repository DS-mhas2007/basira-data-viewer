import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import type { CleanStep } from "../cleaning";
import {
  computeAuditSeal,
  computeAuditSealIfCurrent,
  createIncompleteAuditSeal,
  isAuditSealSourceCurrent,
  type AuditSealOutputSnapshot,
  type AuditSealSourceIdentity,
} from "../audit-seal";
import { finalizeDatasetOutputFingerprint, hashOutputFingerprintChunk } from "../dataset-output-fingerprint";

const sourceFingerprint = `content-v1:sha256:${"a".repeat(64)}`;
const source: AuditSealSourceIdentity = {
  alias: "orders__Sheet1",
  contentFingerprint: sourceFingerprint,
  sourceRevision: 4,
  relationRevision: 8,
};
const schema = [
  { name: "order_id", type: "VARCHAR" },
  { name: "amount", type: "DOUBLE" },
];

function step(
  kind: CleanStep["kind"],
  params: CleanStep["params"],
  label = kind,
): CleanStep {
  return { id: kind, kind, label, affectedRows: 1, params };
}

async function output(
  rows: Array<[string, string]>,
  rowCount: number,
  outputSchema = schema,
): Promise<AuditSealOutputSnapshot> {
  const orderedRows = [...rows].sort(([left], [right]) => left.localeCompare(right));
  const chunk = rows.length ? await hashOutputFingerprintChunk(orderedRows) : null;
  const fingerprint = await finalizeDatasetOutputFingerprint(
    outputSchema,
    String(rowCount),
    chunk ? [chunk] : [],
  );
  return {
    fingerprint,
    rowCount,
    schema: outputSchema,
    relationRevision: source.relationRevision,
    engineVersion: "v1.3.2",
  };
}

describe("audit seal source/output provenance", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  afterAll(() => vi.unstubAllGlobals());

  it("records distinct source, transformation, execution and output identities for an unchanged dataset", async () => {
    const snapshot = await output([['{"order_id":"a","amount":2}', "1"]], 1);
    const seal = await computeAuditSeal({
      fileName: "orders.csv",
      source,
      sourceFingerprint,
      steps: [],
      output: snapshot,
    });

    expect(seal.status).toBe("complete");
    expect(seal.source.fingerprint).toBe(sourceFingerprint);
    expect(seal.transformation.fingerprint).toMatch(/^transform-v1:sha256:/);
    expect(seal.execution?.fingerprint).toMatch(/^execution-v1:sha256:/);
    expect(seal.output?.fingerprint).toBe(snapshot.fingerprint);
    expect(seal.output?.fingerprint).not.toBe(seal.source.fingerprint);
    const sameSnapshot = await computeAuditSeal({
      fileName: "orders.csv",
      source,
      sourceFingerprint,
      steps: [],
      output: snapshot,
    });
    expect(sameSnapshot.execution?.fingerprint).toBe(seal.execution?.fingerprint);
  });

  it("changes the output identity after deduplication while retaining duplicate multiplicity semantics", async () => {
    const repeated = '{"order_id":"a","amount":2}';
    const before = await output([[repeated, "2"]], 2);
    const after = await output([[repeated, "1"]], 1);
    const seal = await computeAuditSeal({
      fileName: "orders.csv",
      source,
      sourceFingerprint,
      steps: [step("dedupe", { allColumns: ["order_id", "amount"] })],
      output: after,
    });

    expect(before.fingerprint).not.toBe(after.fingerprint);
    expect(seal.source.fingerprint).toBe(sourceFingerprint);
    expect(seal.output?.fingerprint).toBe(after.fingerprint);
    expect(seal.output?.rowCount).toBe(1);
    expect(seal.transformation.steps).toHaveLength(1);
  });

  it("records filtered output independently from unchanged source identity", async () => {
    const before = await output([
      ['{"order_id":"a","amount":2}', "1"],
      ['{"order_id":"b","amount":8}', "1"],
    ], 2);
    const filtered = await output([['{"order_id":"b","amount":8}', "1"]], 1);
    const seal = await computeAuditSeal({
      fileName: "orders.csv",
      source,
      sourceFingerprint,
      steps: [],
      output: filtered,
    });

    expect(before.fingerprint).not.toBe(filtered.fingerprint);
    expect(seal.source.fingerprint).toBe(sourceFingerprint);
    expect(seal.output?.fingerprint).toBe(filtered.fingerprint);
    expect(seal.output?.rowCount).toBe(1);
  });

  it("preserves column transformation metadata and ordered multi-step recipes", async () => {
    const cast = step("cast", { allColumns: ["amount"], column: "amount", target: "DOUBLE" });
    const trim = step("trim", { allColumns: ["order_id"], textColumns: ["order_id"] });
    const original = await output(
      [['{"order_id":"a","amount":"2"}', "1"]],
      1,
      [{ name: "order_id", type: "VARCHAR" }, { name: "amount", type: "VARCHAR" }],
    );
    const transformedOutput = await output([['{"order_id":"a","amount":2}', "1"]], 1);
    const seal = await computeAuditSeal({
      fileName: "orders.csv",
      source,
      sourceFingerprint,
      steps: [trim, cast],
      output: transformedOutput,
    });

    expect(seal.transformation.steps.map((item) => item.kind)).toEqual(["trim", "cast"]);
    expect(seal.transformation.steps[1]?.parameters.target).toBe("DOUBLE");
    expect(seal.source.fingerprint).toBe(sourceFingerprint);
    expect(seal.output?.fingerprint).not.toBe(original.fingerprint);
    expect(seal.transformation.fingerprint).not.toBe(
      (await computeAuditSeal({
        fileName: "orders.csv",
        source,
        sourceFingerprint,
        steps: [cast, trim],
        output: transformedOutput,
      })).transformation.fingerprint,
    );
    expect(seal.transformation.fingerprint).not.toBe(
      (await computeAuditSeal({
        fileName: "orders.csv",
        source,
        sourceFingerprint,
        steps: [trim, step("cast", { allColumns: ["amount"], column: "amount", target: "DATE" })],
        output: transformedOutput,
      })).transformation.fingerprint,
    );
  });

  it("changes output identity when data changes without changing the source", async () => {
    const first = await output([['{"order_id":"a","amount":2}', "1"]], 1);
    const changed = await output([['{"order_id":"a","amount":3}', "1"]], 1);
    const firstSeal = await computeAuditSeal({
      fileName: "orders.csv", source, sourceFingerprint, steps: [], output: first,
    });
    const changedSeal = await computeAuditSeal({
      fileName: "orders.csv", source, sourceFingerprint, steps: [], output: changed,
    });

    expect(firstSeal.source.fingerprint).toBe(changedSeal.source.fingerprint);
    expect(firstSeal.output?.fingerprint).not.toBe(changedSeal.output?.fingerprint);
    expect(firstSeal.execution?.fingerprint).not.toBe(changedSeal.execution?.fingerprint);
  });

  it("marks replacement sources and mismatched active relation revisions incomplete", async () => {
    const snapshot = await output([['{"order_id":"a","amount":2}', "1"]], 1);
    const replaced = await computeAuditSeal({
      fileName: "replacement.csv",
      source: {
        ...source,
        contentFingerprint: `content-v1:sha256:${"b".repeat(64)}`,
        sourceRevision: source.sourceRevision + 1,
        relationRevision: source.relationRevision + 1,
      },
      sourceFingerprint: `content-v1:sha256:${"b".repeat(64)}`,
      steps: [],
      output: snapshot,
    });
    const staleOutput = await computeAuditSeal({
      fileName: "orders.csv",
      source,
      sourceFingerprint,
      steps: [],
      output: { ...snapshot, relationRevision: snapshot.relationRevision + 1 },
    });

    expect(replaced.status).toBe("incomplete");
    expect(staleOutput.status).toBe("incomplete");
    expect(staleOutput.output).toBeNull();
  });

  it("does not publish an asynchronous seal after its captured dataset becomes stale", async () => {
    const snapshot = await output([['{"order_id":"a","amount":2}', "1"]], 1);
    let current = true;
    const pending = computeAuditSealIfCurrent({
      fileName: "orders.csv",
      source,
      sourceFingerprint,
      steps: [],
      output: snapshot,
    }, () => current);
    current = false;

    await expect(pending).resolves.toBeNull();
  });

  it("supports empty outputs, nulls and duplicate rows without losing schema or multiplicity", async () => {
    const empty = await output([], 0);
    const nullable = await output([['{"order_id":null,"amount":null}', "2"]], 2);
    const emptySeal = await computeAuditSeal({
      fileName: "orders.csv", source, sourceFingerprint, steps: [], output: empty,
    });
    const nullableSeal = await computeAuditSeal({
      fileName: "orders.csv", source, sourceFingerprint, steps: [], output: nullable,
    });

    expect(emptySeal.status).toBe("complete");
    expect(emptySeal.output).toMatchObject({ rowCount: 0, schema });
    expect(nullableSeal.status).toBe("complete");
    expect(nullable.rowCount).toBe(2);
    expect(nullable.fingerprint).not.toBe(await output([['{"order_id":null,"amount":null}', "1"]], 1).then((value) => value.fingerprint));
  });

  it("is deterministic when row order changes under the unordered-row semantics", async () => {
    const rows = [
      ['{"order_id":"a","amount":2}', "2"],
      ['{"order_id":"b","amount":8}', "1"],
    ] as Array<[string, string]>;
    const first = await output(rows, 3);
    const second = await output([...rows].reverse(), 3);
    expect(first.fingerprint).toBe(second.fingerprint);
  });

  it("does not accept stale asynchronous source identities", () => {
    expect(isAuditSealSourceCurrent(source, { ...source })).toBe(true);
    expect(isAuditSealSourceCurrent(source, { ...source, relationRevision: 9 })).toBe(false);
    expect(isAuditSealSourceCurrent(source, null)).toBe(false);
  });

  it("reports fingerprint calculation failures as incomplete evidence", async () => {
    const snapshot = await output([['{"order_id":"a","amount":2}', "1"]], 1);
    vi.stubGlobal("crypto", {
      subtle: { digest: vi.fn().mockRejectedValue(new Error("crypto unavailable")) },
    });
    const seal = await computeAuditSeal({
      fileName: "orders.csv",
      source,
      sourceFingerprint,
      steps: [],
      output: snapshot,
    });

    expect(seal.status).toBe("incomplete");
    expect(seal.execution).toBeNull();
    expect(seal.issues).toContain("تعذّر حساب بصمة وصف التحويل.");
  });

  it("never represents a source-only fingerprint as an output identity", () => {
    const seal = createIncompleteAuditSeal({
      fileName: "orders.csv",
      source,
      sourceFingerprint,
      steps: [],
      reason: "output fingerprint failed",
    });
    expect(seal.status).toBe("incomplete");
    expect(seal.source.fingerprint).toBe(sourceFingerprint);
    expect(seal.output).toBeNull();
    expect(seal.issues).toEqual(["output fingerprint failed"]);
  });

  it("keeps transformation evidence but marks a failed output fingerprint incomplete", async () => {
    const seal = await computeAuditSeal({
      fileName: "orders.csv",
      source,
      sourceFingerprint,
      steps: [step("dedupe", { allColumns: ["order_id", "amount"] })],
      output: null,
    });

    expect(seal.status).toBe("incomplete");
    expect(seal.source.fingerprint).toBe(sourceFingerprint);
    expect(seal.transformation.fingerprint).toMatch(/^transform-v1:sha256:/);
    expect(seal.output).toBeNull();
    expect(seal.execution).toBeNull();
  });
});
