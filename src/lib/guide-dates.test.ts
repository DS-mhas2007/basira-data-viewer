import { describe, expect, it } from "vitest";
import { guideArticle } from "./seo";
import { guideDates } from "./guide-dates";

describe("guide dates", () => {
  it("يعيد تواريخ ISO صالحة للمسار الكامل أو النسبي", () => {
    const a = guideDates("/guide/csv-vs-excel");
    const b = guideDates("https://basira-data-viewer.lovable.app/guide/csv-vs-excel/");
    expect(a).toEqual(b);
    expect(a.published).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(a.updated >= a.published).toBe(true);
  });
  it("BlogPosting يتضمن datePublished و dateModified", () => {
    const ld = JSON.parse(guideArticle("t", "d", "https://x.test/guide/csv-vs-excel").children);
    expect(ld.datePublished).toBeTruthy();
    expect(ld.dateModified).toBeTruthy();
  });
});
