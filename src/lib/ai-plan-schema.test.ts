import { describe, expect, it } from "vitest";
import { AiPlanZ, normalizeAiPlanPayload } from "./ai-plan-schema";

describe("MIZYAi SQL plan response normalization", () => {
  it("accepts a minimal model response and supplies optional chart defaults", () => {
    const raw = {
      intent: "overview",
      title: "ملخص الطلبات",
      sql: 'SELECT COUNT(*) AS total_rows FROM "dataset" LIMIT 1',
      chart: { type: "table" },
      needsClarification: false,
    };

    const parsed = AiPlanZ.safeParse(normalizeAiPlanPayload(raw));

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.intent).toBe("summary");
      expect(parsed.data.title_ar).toBe("ملخص الطلبات");
      expect(parsed.data.chart).toEqual({ type: "table", x: null, y: [], series: null });
    }
  });

  it("unwraps a plan envelope and normalizes common chart aliases", () => {
    const raw = {
      plan: {
        intent: "time series",
        title_ar: "المبيعات عبر الزمن",
        query: 'SELECT "OrderDate", SUM("TotalAmount") AS revenue FROM "dataset" GROUP BY 1 LIMIT 100',
        chart: { chartType: "line_chart", xAxis: "OrderDate", yAxis: "revenue" },
        needs_clarification: "false",
      },
    };

    const parsed = AiPlanZ.safeParse(normalizeAiPlanPayload(raw));

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.intent).toBe("trend");
      expect(parsed.data.sql).toContain("SUM");
      expect(parsed.data.chart).toEqual({
        type: "line",
        x: "OrderDate",
        y: ["revenue"],
        series: null,
      });
    }
  });

  it("keeps an absent SQL query empty instead of inventing one", () => {
    const parsed = AiPlanZ.safeParse(normalizeAiPlanPayload({
      intent: "summary",
      title_ar: "ملخص",
      chart: { type: "table" },
    }));

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.sql).toBe("");
  });

  it("rejects non-object model output", () => {
    expect(AiPlanZ.safeParse(normalizeAiPlanPayload("not-json-object")).success).toBe(false);
  });
});
