import { describe, expect, it } from "vitest";
import { buildNextSteps } from "./NextSteps";
import type { HealthReport } from "@/lib/data-health";

const base = { missingCells: 0, duplicateRows: 0, mismatchedColumns: 0 } as HealthReport;

describe("buildNextSteps", () => {
  it("يبدأ بالتنظيف إن وُجدت مشاكل", () => {
    const s = buildNextSteps({ ...base, missingCells: 12, duplicateRows: 3 });
    expect(s[0]!.id).toBe("quality");
    expect(s[0]!.hint).toContain("12");
  });
  it("بلا مشاكل لا يقترح التنظيف", () => {
    expect(buildNextSteps(base).some((x) => x.id === "quality")).toBe(false);
  });
  it("بلا تقرير صحة يعرض الخطوات الأساسية", () => {
    expect(buildNextSteps(null).map((x) => x.id)).toEqual(["ask", "analysis", "insights"]);
  });
});
