import { describe, expect, it } from "vitest";
import {
  buildSuggestPayload,
  validateSuggestions,
  MAX_SUGGEST_POINTS,
} from "@/lib/chart-ai-suggest";

const info = {
  schema: [
    { name: "الفئة", type: "VARCHAR" },
    { name: "المبلغ", type: "DOUBLE" },
    { name: "الاسم", type: "VARCHAR" },
  ],
};
describe("chart AI suggest", () => {
  it("payload is capped and contains no raw rows", () => {
    const pts = Array.from({ length: 100 }, (_, i) => ({ label: `c${i}`, value: i }));
    const p = buildSuggestPayload(info, { kind: "bar", x: "الفئة", y: "المبلغ", agg: "SUM" }, pts);
    expect(p.points).toHaveLength(MAX_SUGGEST_POINTS);
    expect(p.totalPoints).toBe(100);
    expect(Object.keys(p).sort()).toEqual(["columns", "current", "points", "totalPoints"]);
  });
  it("keeps only valid suggestions", () => {
    const raw = {
      suggestions: [
        { title_ar: "ok", why_ar: "w", kind: "line", x: "الفئة", y: "المبلغ", agg: "AVG" },
        { title_ar: "bad kind", why_ar: "w", kind: "3d" },
        { title_ar: "missing col", why_ar: "w", kind: "bar", x: "غير موجود" },
        { title_ar: "text measure", why_ar: "w", kind: "bar", x: "الفئة", y: "الاسم", agg: "SUM" },
        { title_ar: "count ok", why_ar: "w", kind: "bar", x: "الفئة", y: "الاسم", agg: "COUNT" },
      ],
    };
    const r = validateSuggestions(raw, info);
    expect(r.map((s) => s.title)).toEqual(["ok", "count ok"]);
    expect(r[0]!.patch).toEqual({ kind: "line", x: "الفئة", y: "المبلغ", agg: "AVG" });
  });
  it("rejects malformed responses", () => {
    expect(validateSuggestions("x", info)).toEqual([]);
    expect(validateSuggestions({ suggestions: [{ nope: 1 }] }, info)).toEqual([]);
  });
});
