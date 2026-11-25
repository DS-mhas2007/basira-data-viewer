import { describe, expect, it } from "vitest";
import { domainIntent, domainTail, pickVariant, stableHash } from "./report-phrasing";

describe("report-phrasing", () => {
  it("is deterministic", () => {
    expect(stableHash("a")).toBe(stableHash("a"));
    const v = ["x", "y", "z"] as const;
    expect(pickVariant("k1", v, "s")).toBe(pickVariant("k1", v, "s"));
  });
  it("covers all variants across keys", () => {
    const v = ["x", "y"] as const;
    const seen = new Set(Array.from({ length: 40 }, (_, i) => pickVariant(`k${i}`, v)));
    expect(seen.size).toBe(2);
  });
  it("domain tails have no digits and skip generic", () => {
    expect(domainTail("generic", "ranking", "k")).toBeNull();
    for (const d of ["ecommerce", "hr", "health", "finance"] as const) {
      for (const i of [
        "ranking",
        "compare",
        "trend",
        "distribution",
        "anomaly",
        "summary",
        "default",
      ] as const) {
        const t = domainTail(d, i, "k");
        if (t) expect(t).not.toMatch(/[0-9٠-٩]/);
      }
    }
  });
  it("maps unknown intents to default", () => {
    expect(domainIntent("zzz")).toBe("default");
  });
});
