import { describe, it, expect } from "vitest";
import { pickHighlights } from "./evidence";
const plan = (x: string|null, y: string[]) => ({ intent:"ranking", title_ar:"t", sql:"", chart:{type:"kpi",x,y,series:null}, explanation_plan:[], warnings:[], needs_clarification:false, clarification_question:null }) as any;
describe("pickHighlights", () => {
  it("worst year: sales is the metric, year is context", () => {
    const rows = [{ Year: 2017, Global_Sales: 0.06 }];
    for (const p of [plan("Global_Sales", ["Year"]), plan("Year", ["Global_Sales"]), plan(null, [])]) {
      const h = pickHighlights(p, rows);
      expect(h.length).toBe(1);
      expect(h[0].value).toBe("0.06");
      expect(h[0].label).toBe("Global_Sales — 2017");
    }
  });
});
