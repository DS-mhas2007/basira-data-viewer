import { describe, expect, it } from "vitest";
import { finalizeDatasetOutputFingerprint, hashOutputFingerprintChunk } from "../dataset-output-fingerprint";

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
    expect(await finalizeDatasetOutputFingerprint([...schema].reverse(), "2", [original])).not.toBe(base);
    expect(await finalizeDatasetOutputFingerprint(
      [{ ...schema[0]!, type: "INTEGER" }, schema[1]!],
      "2",
      [original],
    )).not.toBe(base);
    expect(await finalizeDatasetOutputFingerprint(schema, "4", [original])).not.toBe(base);
  });

  it("binds ordered columns and canonical NULL/date/timestamp row values", async () => {
    const canonicalRows = [
      ['{"day":"2026-11-25","created_at":"2026-11-25T10:30:00Z","value":null}', "2"],
      ['{"day":"2026-11-26","created_at":"2026-11-26T10:30:00Z","value":1.5}', "1"],
    ] as Array<[string, string]>;
    const hashCanonicalRows = (rows: Array<[string, string]>) =>
      hashOutputFingerprintChunk([...rows].sort(([left], [right]) => left.localeCompare(right)));
    const ordered = await hashCanonicalRows(canonicalRows);
    const reordered = await hashCanonicalRows([...canonicalRows].reverse());
    const orderedSchema = [
      { name: "day", type: "DATE" },
      { name: "created_at", type: "TIMESTAMP WITH TIME ZONE" },
      { name: "value", type: "DOUBLE" },
    ];
    const base = await finalizeDatasetOutputFingerprint(orderedSchema, "3", [ordered]);

    expect(await finalizeDatasetOutputFingerprint(orderedSchema, "3", [ordered])).toBe(base);
    expect(await finalizeDatasetOutputFingerprint(orderedSchema, "3", [reordered])).toBe(base);
    expect(await finalizeDatasetOutputFingerprint([...orderedSchema].reverse(), "3", [ordered])).not.toBe(base);
  });

  it("rejects incomplete schema, unsafe row count, and malformed chunk digests", async () => {
    await expect(finalizeDatasetOutputFingerprint([], "0", [])).rejects.toThrow();
    await expect(finalizeDatasetOutputFingerprint(schema, "1.5", [])).rejects.toThrow();
    await expect(finalizeDatasetOutputFingerprint(schema, "1", ["bad"])).rejects.toThrow();
  });
});
