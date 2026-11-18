import { describe, expect, it } from "vitest";
import { resolveAskChart } from "./ask-chart";

const plan = (type: string, x: string | null = null, y: string[] = []) =>
  ({ chart: { type, x, y } }) as Parameters<typeof resolveAskChart>[0];

describe("resolveAskChart", () => {
  it("يرسم أعمدة حتى لو أعاد النموذج table", () => {
    const rows = [
      { category: "منزل", total: 10 },
      { category: "رياضة", total: 4 },
    ];
    expect(resolveAskChart(plan("table"), rows)).toMatchObject({
      type: "bar",
      x: "category",
      metrics: ["total"],
      inferred: true,
    });
  });
  it("يتعرّف على BigInt والأعداد النصية كقيم رقمية", () => {
    const rows = [
      { c: "a", n: 3n },
      { c: "b", n: "5.5" },
    ];
    expect(resolveAskChart(plan("bar"), rows)?.metrics).toEqual(["n"]);
  });
  it("يستنتج خطاً للمحور الزمني", () => {
    const rows = [
      { month: "2025-01", v: 1 },
      { month: "2025-02", v: 2 },
    ];
    expect(resolveAskChart(plan("table"), rows)?.type).toBe("line");
  });
  it("صف واحد = بطاقة رقم، ولا شيء بلا أعمدة رقمية", () => {
    expect(resolveAskChart(plan("table"), [{ total: 9 }])?.type).toBe("kpi");
    expect(resolveAskChart(plan("table"), [{ a: "x" }, { a: "y" }])).toBeNull();
  });
});
