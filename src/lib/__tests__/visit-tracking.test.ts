import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter, isSameOriginRequest, normalizeTrackPath } from "../visit-tracking";

describe("normalizeTrackPath", () => {
  it("keeps a same-site pathname and strips query strings and fragments", () => {
    expect(normalizeTrackPath("/guide/data-privacy-browser?source=email#controls")).toBe(
      "/guide/data-privacy-browser",
    );
  });

  it("rejects admin, API, auth, absolute, malformed, and control-character paths", () => {
    for (const path of [
      "/admin",
      "/admin/users",
      "/api/track",
      "/auth",
      "//outside.example/path",
      "https://outside.example/path",
      "/bad\\path",
      "/bad\u0000path",
    ]) {
      expect(normalizeTrackPath(path), path).toBeNull();
    }
  });

  it("does not treat similarly named public paths as admin routes", () => {
    expect(normalizeTrackPath("/administrator")).toBe("/administrator");
  });
});

describe("isSameOriginRequest", () => {
  it("requires an exact origin match", () => {
    expect(isSameOriginRequest("https://mizya.example", "https://mizya.example/api/track")).toBe(
      true,
    );
    expect(isSameOriginRequest("https://evil.example", "https://mizya.example/api/track")).toBe(
      false,
    );
    expect(isSameOriginRequest(null, "https://mizya.example/api/track")).toBe(false);
  });
});

describe("FixedWindowRateLimiter", () => {
  it("limits requests per key and opens a new window", () => {
    const limiter = new FixedWindowRateLimiter(2, 1_000);
    expect(limiter.allow("visitor-a", 100)).toBe(true);
    expect(limiter.allow("visitor-a", 200)).toBe(true);
    expect(limiter.allow("visitor-a", 300)).toBe(false);
    expect(limiter.allow("visitor-a", 1_100)).toBe(true);
    expect(limiter.allow("visitor-b", 300)).toBe(true);
  });
});
