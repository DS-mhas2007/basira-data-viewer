import { describe, expect, it } from "vitest";
import { buildHealthReportCacheKey } from "../data-health";

describe("data health in-flight identity", () => {
  const schema = [{ name: "id", type: "INTEGER" }, { name: "value", type: "DOUBLE" }];
  const sourceA = { alias: "sales", contentFingerprint: "content-v1:sha256:aaa", sourceRevision: 7 };

  it("shares work only for the exact same source snapshot", () => {
    const first = buildHealthReportCacheKey("dataset", schema, sourceA, 20);
    expect(buildHealthReportCacheKey("dataset", schema, sourceA, 20)).toBe(first);
    expect(buildHealthReportCacheKey("dataset", schema,
      { ...sourceA, contentFingerprint: "content-v1:sha256:bbb", sourceRevision: 8 }, 21)).not.toBe(first);
  });

  it("separates identical schemas across relation revisions and source aliases", () => {
    const first = buildHealthReportCacheKey("dataset", schema, sourceA, 20);
    expect(buildHealthReportCacheKey("dataset", schema, sourceA, 21)).not.toBe(first);
    expect(buildHealthReportCacheKey("dataset", schema, { ...sourceA, alias: "archive" }, 20)).not.toBe(first);
  });
});
