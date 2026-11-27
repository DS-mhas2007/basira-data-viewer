import { describe, expect, it } from "vitest";
import { buildLocalAskPlan } from "./local-ask-plan";

const tableInfo = {
  table: "dataset",
  rowCount: 3,
  schema: [
    { name: "region", type: "VARCHAR" },
    { name: "revenue", type: "DOUBLE" },
  ],
};

describe("buildLocalAskPlan", () => {
  it("builds a full-table aggregate without a result limit", () => {
    const plan = buildLocalAskPlan("ما إجمالي الإيرادات؟", tableInfo);
    expect(plan?.sql).toBe('SELECT SUM("revenue") AS "total_value" FROM "dataset"');
    expect(plan?.sql).not.toMatch(/LIMIT/i);
  });

  it("builds a grouped ranking with only a final result limit", () => {
    const plan = buildLocalAskPlan("ما أعلى المناطق حسب الإيرادات؟", tableInfo);
    expect(plan?.sql).toContain('GROUP BY "region"');
    expect(plan?.sql).toMatch(/LIMIT 10$/);
    expect(plan?.sql).not.toContain("SELECT revenue FROM");
  });

  it("returns null instead of guessing a complex question", () => {
    expect(buildLocalAskPlan("اشرح العلاقة بين كل المتغيرات", tableInfo)).toBeNull();
  });
});
