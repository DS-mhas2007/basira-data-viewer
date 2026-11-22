import { describe, expect, it } from "vitest";
import { compareMetricOutputFingerprint } from "../metric-definition-registry";

describe("metric output fingerprint comparison", () => {
  const first = `output-v1:sha256:${"a".repeat(64)}`;
  const changed = `output-v1:sha256:${"b".repeat(64)}`;

  it("accepts only complete matching output evidence", () => {
    expect(compareMetricOutputFingerprint(first, first).status).toBe("aligned");
    expect(compareMetricOutputFingerprint(first, changed).status).toBe("mismatch");
    expect(compareMetricOutputFingerprint(undefined, first).status).toBe("insufficient-evidence");
    expect(compareMetricOutputFingerprint(first, null).status).toBe("insufficient-evidence");
  });
});
