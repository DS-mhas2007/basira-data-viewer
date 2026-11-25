import { describe, expect, it } from "vitest";
import { buildHealthInFlightKey } from "../data-health";

describe("health report in-flight identity", () => {
  const schema = [{ name: "id", type: "INTEGER" }, { name: "value", type: "DOUBLE" }];
  const source = { alias: "sales", contentFingerprint: "content-v1:sha256:aaa", sourceRevision: 3 };

  it("does not coalesce scans across different source content with the same schema", () => {
    const first = buildHealthInFlightKey("dataset", schema, source, 7);
    const second = buildHealthInFlightKey(
      "dataset", schema,
      { ...source, contentFingerprint: "content-v1:sha256:bbb", sourceRevision: 4 },
      8,
    );
    expect(first).not.toBe(second);
  });

  it("does not coalesce scans across active relation revisions", () => {
    expect(buildHealthInFlightKey("dataset", schema, source, 7))
      .not.toBe(buildHealthInFlightKey("dataset", schema, source, 8));
  });

  it("keeps identical in-flight snapshots deduplicated", () => {
    expect(buildHealthInFlightKey("dataset", schema, source, 7))
      .toBe(buildHealthInFlightKey("dataset", schema, source, 7));
  });
});
