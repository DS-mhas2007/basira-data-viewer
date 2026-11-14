import { describe, expect, it } from "vitest";
import { isSameProjectScope } from "@/lib/chat-project-scope";

describe("isSameProjectScope", () => {
  it("matches the same project identifier", () => {
    expect(isSameProjectScope("project-a", "project-a")).toBe(true);
  });

  it("rejects threads owned by another project", () => {
    expect(isSameProjectScope("project-a", "project-b")).toBe(false);
  });

  it("keeps legacy unscoped threads separate from project threads", () => {
    expect(isSameProjectScope(null, "project-a")).toBe(false);
    expect(isSameProjectScope("project-a", null)).toBe(false);
    expect(isSameProjectScope(undefined, null)).toBe(true);
  });
});