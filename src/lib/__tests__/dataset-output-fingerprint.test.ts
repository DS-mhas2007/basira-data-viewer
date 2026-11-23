import { describe, expect, it } from "vitest";
import {
  finalizeDatasetOutputFingerprint,
  finalizeQueryOutputFingerprint,
  fingerprintQuerySql,
  hashOutputFingerprintChunk,
} from "../dataset-output-fingerprint";

const schema = [{ name: "patient_id", type: "VARCHAR" }, { name: "score", type: "DOUBLE" }];

describe("dataset output fingerprint", () => {
  it("is deterministic for sorted canonical rows and multiplicities", async () => {
    const rows = [['{"patient_id":"p1","score":1}', "2"], ['{"patient_id":"p2","score":3}', "1"]] as Array<[string, string]>;
    const chunk = await hashOutputFingerprintChunk(rows);
    const first = await finalizeDatasetOutputFingerprint(schema, "3", [chunk]);
    const second = await finalizeDatasetOutputFingerprint(schema, "3", [chunk]);
    expect(first).toBe(second);
    expect(first).toMatch(/^output-v1:sha256:[0-9a-f]{64}$/);
  });

  it("changes when output values, multiplicity, schema, or row count change", async () => {
    const original = await hashOutputFingerprintChunk([['{"patient_id":"p1","score":1}', "2"]]);
    const changedValue = await hashOutputFingerprintChunk([['{"patient_id":"p1","score":2}', "2"]]);
    const changedMultiplicity = await hashOutputFingerprintChunk([['{"patient_id":"p1","score":1}', "3"]]);
    const base = await finalizeDatasetOutputFingerprint(schema, "2", [original]);
    expect(await finalizeDatasetOutputFingerprint(schema, "2", [changedValue])).not.toBe(base);
    expect(await finalizeDatasetOutputFingerprint(schema, "3", [changedMultiplicity])).not.toBe(base);
    expect(await finalizeDatasetOutputFingerprint([...schema, { name: "site", type: "VARCHAR" }], "2", [original])).not.toBe(base);
    expect(await finalizeDatasetOutputFingerprint(schema, "4", [original])).not.toBe(base);
  });

  it("rejects incomplete schema, unsafe row count, and malformed chunk digests", async () => {
    await expect(finalizeDatasetOutputFingerprint([], "0", [])).rejects.toThrow();
    await expect(finalizeDatasetOutputFingerprint(schema, "1.5", [])).rejects.toThrow();
    await expect(finalizeDatasetOutputFingerprint(schema, "1", ["bad"])).rejects.toThrow();
  });
});

describe("query output fingerprint", () => {
  it("binds the complete result snapshot to the exact SQL text", async () => {
    const chunk = await hashOutputFingerprintChunk([
      ['{"customer_id":"c1","total":12}', "2"],
      ['{"customer_id":"c2","total":19}', "1"],
    ]);
    const query = "SELECT customer_id, SUM(total) AS total FROM orders GROUP BY customer_id";
    const queryFingerprint = await fingerprintQuerySql(query);
    const first = await finalizeQueryOutputFingerprint(schema, "3", [chunk], queryFingerprint);
    const second = await finalizeQueryOutputFingerprint(schema, "3", [chunk], queryFingerprint);
    const differentQuery = await finalizeQueryOutputFingerprint(
      schema,
      "3",
      [chunk],
      await fingerprintQuerySql("SELECT customer_id, SUM(total) AS total FROM orders GROUP BY customer_id HAVING SUM(total) > 10"),
    );

    expect(first).toBe(second);
    expect(first).not.toBe(differentQuery);
    expect(first).toMatch(/^query-output-v1:sha256:[0-9a-f]{64}$/);
    expect(queryFingerprint).toMatch(/^query-sql-v1:sha256:[0-9a-f]{64}$/);
  });

  it("rejects incomplete query SQL, invalid SQL fingerprints, and malformed chunks", async () => {
    await expect(fingerprintQuerySql("  ")).rejects.toThrow();
    await expect(finalizeQueryOutputFingerprint(schema, "1", [], "bad")).rejects.toThrow();
    await expect(finalizeQueryOutputFingerprint(schema, "1", ["bad"], await fingerprintQuerySql("SELECT 1"))).rejects.toThrow();
  });
});
