import { describe, expect, it } from "vitest";
import { buildHtmlReport } from "../html-report";

function inputWithRows(count: number) {
  return {
    fileName: "sales.csv",
    health: null,
    rowCount: count,
    columnCount: 2,
    cleanSteps: [],
    insights: [
      {
        evidence: { title: "المبيعات حسب المنطقة", highlights: [], sql: 'SELECT "region", SUM("sales") FROM dataset' },
        rows: Array.from({ length: count }, (_, index) => ({
          region: "منطقة " + (index + 1),
          sales: index + 1,
        })),
      },
    ],
    signals: [],
    seal: null,
    playbook: null,
  } as never;
}

describe("buildHtmlReport preview limits", () => {
  it("labels the 200-row table cap and 12-point chart preview", () => {
    const html = buildHtmlReport(inputWithRows(201));

    expect(html).toContain("المخطط يعرض أول 12 نقطة من نتائج الاستعلام.");
    expect(html).toContain("يعرض الجدول أول 200 من أصل 201 صفاً.");
    expect(html).toContain("عرض جدول النتائج (200 من 201 صف)");
  });

  it("does not show truncation notices when all rows fit", () => {
    const html = buildHtmlReport(inputWithRows(3));

    expect(html).not.toContain("يعرض الجدول أول");
    expect(html).not.toContain("المخطط يعرض أول 12 نقطة");
    expect(html).toContain("عرض جدول النتائج (3 من 3 صف)");
  });
});
