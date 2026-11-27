import { describe, expect, it } from "vitest";
import { formatDuration, slowQueryHint } from "@/lib/chart-perf";

describe("chart perf", () => {
  it("formats durations", () => {
    expect(formatDuration(120.4)).toBe("120 مللي ث");
    expect(formatDuration(2400)).toBe("2.4 ث");
  });
  it("hints only when slow", () => {
    expect(slowQueryHint(300, 10, 0)).toBeNull();
    expect(slowQueryHint(2500, 5_000_000, 0)).toContain("الجدول كبير جداً");
    expect(slowQueryHint(2500, 100, 10)).not.toContain("حدّد عدداً");
  });
});
