import { describe, expect, it } from "vitest";
import { buildOverview } from "./report-derive";

const health = { score: 82, rowCount: 100, columnCount: 4, totalCells: 400, missingCells: 20, missingRatio: 0.05, duplicateRows: 3, duplicateRatio: 0.03, mismatchedColumns: 1, deductions: { missing: 5, duplicates: 8, typeMismatch: 5 }, columns: [], issues: [] } as never;

describe("buildOverview", () => {
  it("states size, quality and cautions from real numbers", () => {
    const o = buildOverview([], health, 100, 4, []);
    expect(o.snapshot).toContain("100 صفاً و4 أعمدة");
    expect(o.snapshot).toContain("82 من 100");
    expect(o.cautions.join("|")).toContain("20 خلية فارغة (5% من الخلايا)");
    expect(o.cautions.join("|")).toContain("3 صفاً مكرراً");
    expect(o.findings).toEqual([]);
  });
  it("works without a health report", () => {
    const o = buildOverview([], null, 5, 1, []);
    expect(o.snapshot).toBe("يضم الملف 5 صفاً وعموداً.".replace("وعموداً", "و1 عموداً"));
    expect(o.cautions).toEqual([]);
  });
});
