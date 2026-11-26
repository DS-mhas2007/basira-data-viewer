import { describe, expect, it } from "vitest";
import { buildDatasetViewCacheKey } from "../dataset-view-key";

describe("buildDatasetViewCacheKey", () => {
  const base = {
    fileName: "sales.csv",
    sheet: "Sheet1",
    contentFingerprint: "content-v1:sha256:aaa",
    relationRevision: 12,
  };

  it("changes when content changes even if the filename and sheet stay the same", () => {
    expect(buildDatasetViewCacheKey(base)).not.toBe(
      buildDatasetViewCacheKey({ ...base, contentFingerprint: "content-v1:sha256:bbb" }),
    );
  });

  it("changes when the active relation changes with the same source content", () => {
    expect(buildDatasetViewCacheKey(base)).not.toBe(
      buildDatasetViewCacheKey({ ...base, relationRevision: 13 }),
    );
  });

  it("is stable for the same dataset view identity", () => {
    expect(buildDatasetViewCacheKey(base)).toBe(buildDatasetViewCacheKey({ ...base }));
  });
});
