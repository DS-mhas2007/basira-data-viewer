import { describe, expect, it } from "vitest";
import { buildHtmlReport } from "../html-report";
import type { AuditSeal } from "../audit-seal";

function inputWithRows(count: number, seal: AuditSeal | null = null) {
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
    seal,
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

  it("exports source and output identities separately without authenticity claims", () => {
    const seal: AuditSeal = {
      status: "complete",
      fileName: "sales.csv",
      issuedAt: "2026-11-25T10:00:00.000Z",
      relationRevision: 2,
      source: {
        alias: "sales__Sheet1",
        fingerprint: `content-v1:sha256:${"a".repeat(64)}`,
        sourceRevision: 1,
      },
      transformation: { fingerprint: `transform-v1:sha256:${"b".repeat(64)}`, steps: [] },
      execution: {
        fingerprint: `execution-v1:sha256:${"c".repeat(64)}`,
        context: "client-side",
        engine: "DuckDB-WASM",
        engineVersion: "v1.3.2",
        sourceRevision: 1,
        relationRevision: 2,
        attestedAt: "2026-11-25T10:00:00.000Z",
      },
      output: {
        fingerprint: `output-v1:sha256:${"d".repeat(64)}`,
        rowCount: 4,
        schema: [{ name: "amount", type: "DOUBLE" }],
      },
      issues: [],
    };
    const html = buildHtmlReport(inputWithRows(4, seal));

    expect(html).toContain("المصدر الأصلي");
    expect(html).toContain("الناتج التحليلي");
    expect(html).toContain("ليس توقيعاً رقمياً");
    expect(html).toContain("لا تثبت أصالة الملف");
    expect(html).toContain(seal.output.fingerprint);
    expect(html).not.toContain("ختم المصداقية — تحليل محلي موثّق");
  });
});
