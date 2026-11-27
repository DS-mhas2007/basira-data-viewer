import { describe, expect, it } from "vitest";
import { buildLocalAskPlan } from "./local-ask-plan";

const tableInfo = {
  table: "dataset",
  rowCount: 3,
  schema: [
    { name: "order_id", type: "VARCHAR" },
    { name: "order_date", type: "DATE" },
    { name: "region", type: "VARCHAR" },
    { name: "category", type: "VARCHAR" },
    { name: "revenue", type: "DOUBLE" },
  ],
};

describe("buildLocalAskPlan", () => {
  it("builds a full-table aggregate without a result limit or deduplication", () => {
    const plan = buildLocalAskPlan("ما إجمالي الإيرادات؟", tableInfo);
    expect(plan?.sql).toBe('SELECT SUM("revenue") AS "total_value" FROM "dataset"');
    expect(plan?.sql).not.toMatch(/LIMIT|DISTINCT/i);
  });

  it("builds a grouped ranking using the dimension named by the user", () => {
    const plan = buildLocalAskPlan("ما أعلى الفئات حسب الإيرادات؟", tableInfo);
    expect(plan?.sql).toContain('GROUP BY "category"');
    expect(plan?.sql).toMatch(/LIMIT 10$/);
    expect(plan?.sql).not.toContain("SELECT revenue FROM");
  });

  it("builds a monthly trend over the complete table", () => {
    const plan = buildLocalAskPlan("ما متوسط الإيرادات حسب شهر الطلب؟", tableInfo);
    expect(plan?.sql).toContain("DATE_TRUNC('month'");
    expect(plan?.sql).toContain('AVG("revenue")');
    expect(plan?.sql).toContain("GROUP BY 1");
    expect(plan?.sql).toMatch(/LIMIT 1000$/);
  });

  it("counts exact duplicate rows across all available columns", () => {
    const plan = buildLocalAskPlan("هل توجد صفوف مكررة؟", tableInfo);
    expect(plan?.sql).toContain(
      'COUNT(DISTINCT ("order_id", "order_date", "region", "category", "revenue"))',
    );
    expect(plan?.sql).toContain("AS duplicate_rows");
  });

  it("returns null instead of guessing a complex question", () => {
    expect(buildLocalAskPlan("اشرح العلاقة بين كل المتغيرات", tableInfo)).toBeNull();
  });
});
