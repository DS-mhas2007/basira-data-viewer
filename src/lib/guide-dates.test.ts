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
  it("تاريخ تعديل الدليلين الجديدين لا يسبق تاريخ نشرهما", () => {
    for (const path of ["/guide/data-analysis-arabic", "/guide/data-cleaning-arabic"]) {
      const dates = guideDates(path);
      expect(dates.published).toBe("2026-11-18");
      expect(dates.updated).toBe("2026-11-18");
      expect(dates.updated >= dates.published).toBe(true);
    }
  });
  it("يعكس تاريخ تعديل دليل CSV العربي تحديث المحتوى الفعلي", () => {
    const dates = guideDates("/guide/arabic-csv-excel");
    expect(dates.published).toBe("2026-09-03");
    expect(dates.updated).toBe("2026-11-19");
    expect(dates.updated >= dates.published).toBe(true);
  });
  it("BlogPosting يتضمن datePublished و dateModified", () => {
    const ld = JSON.parse(guideArticle("t", "d", "https://x.test/guide/csv-vs-excel").children);
    expect(ld.datePublished).toBeTruthy();
    expect(ld.dateModified).toBeTruthy();
  });
});
