import { describe, expect, it } from "vitest";
import { computeDatasetContentFingerprint } from "../dataset-content-fingerprint";

describe("dataset content fingerprint", () => {
  it("is deterministic for identical complete sheet content", async () => {
    const first = await computeDatasetContentFingerprint(
      ["id", "value"],
      [{ id: 1, value: "alpha" }, { id: 2, value: "beta" }],
    );
    const second = await computeDatasetContentFingerprint(
      ["id", "value"],
      [{ id: 1, value: "alpha" }, { id: 2, value: "beta" }],
    );
    expect(first).toBe(second);
    expect(first).toMatch(/^content-v1:sha256:[0-9a-f]{64}$/);
  });

  it("detects changed values and row order", async () => {
    const baseline = await computeDatasetContentFingerprint(
      ["id", "value"],
      [{ id: 1, value: "alpha" }, { id: 2, value: "beta" }],
    );
    const changedValue = await computeDatasetContentFingerprint(
      ["id", "value"],
      [{ id: 1, value: "changed" }, { id: 2, value: "beta" }],
    );
    const reordered = await computeDatasetContentFingerprint(
      ["id", "value"],
      [{ id: 2, value: "beta" }, { id: 1, value: "alpha" }],
    );
    expect(changedValue).not.toBe(baseline);
    expect(reordered).not.toBe(baseline);
  });

  it("distinguishes types, null, missing values and empty strings", async () => {
    const numeric = await computeDatasetContentFingerprint(["value"], [{ value: 1 }]);
    const textual = await computeDatasetContentFingerprint(["value"], [{ value: "1" }]);
    const empty = await computeDatasetContentFingerprint(["value"], [{ value: "" }]);
    const nullValue = await computeDatasetContentFingerprint(["value"], [{ value: null }]);
    const missing = await computeDatasetContentFingerprint(["value"], [{}]);
    expect(new Set([numeric, textual, empty, nullValue, missing]).size).toBe(5);
  });

  it("includes the ordered column schema in the content identity", async () => {
    const first = await computeDatasetContentFingerprint(["a", "b"], [{ a: 1, b: 2 }]);
    const reordered = await computeDatasetContentFingerprint(["b", "a"], [{ a: 1, b: 2 }]);
    expect(reordered).not.toBe(first);
  });
});
