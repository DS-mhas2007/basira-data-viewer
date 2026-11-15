import { describe, expect, it } from "vitest";
import type { ColumnHealth, HealthReport } from "./data-health";
import { buildDictionary, classifyColumn, dictionaryToCsv, dictionaryToMarkdown } from "./data-dictionary";

const col = (o: Partial<ColumnHealth>): ColumnHealth => ({
  name: "x", type: "VARCHAR", isNumeric: false, nullCount: 0, nullRatio: 0, distinctCount: 5,
  min: null, max: null, median: null, typeMismatchCount: 0, ...o,
});
const report = (columns: ColumnHealth[], rowCount = 1000): HealthReport =>
  ({ rowCount, columns } as unknown as HealthReport);

describe("data-dictionary", () => {
  it("يصنّف أدوار الأعمدة", () => {
    expect(classifyColumn(col({ name: "order_id", type: "BIGINT", isNumeric: true, distinctCount: 1000 }), 1000)).toBe("id");
    expect(classifyColumn(col({ name: "order_date", type: "DATE" }), 1000)).toBe("date");
    expect(classifyColumn(col({ name: "total_sales", type: "DOUBLE", isNumeric: true, distinctCount: 800 }), 1000)).toBe("amount");
    expect(classifyColumn(col({ name: "age", type: "INTEGER", isNumeric: true, distinctCount: 60 }), 1000)).toBe("number");
    expect(classifyColumn(col({ name: "المدينة", distinctCount: 8 }), 1000)).toBe("category");
    expect(classifyColumn(col({ name: "ملاحظة", distinctCount: 400 }), 1000)).toBe("text");
    expect(classifyColumn(col({ name: "email", distinctCount: 1000 }), 1000)).toBe("id");
  });

  it("يبني الملاحظات والأمثلة", () => {
    const [e] = buildDictionary(report([col({ name: "المدينة", nullRatio: 0.2, distinctCount: 3 })]), {
      المدينة: { examples: ["غزة", "عمان"] },
    });
    expect(e!.filled).toBe(80);
    expect(e!.notes.join()).toContain("20%");
    expect(e!.examples).toEqual(["غزة", "عمان"]);
  });

  it("ينبّه على العمود الثابت والأنواع المختلطة", () => {
    const [a, b] = buildDictionary(
      report([col({ name: "a", distinctCount: 1 }), col({ name: "b", type: "VARCHAR", typeMismatchCount: 7 })]),
    );
    expect(a!.notes.join()).toContain("ثابتة");
    expect(b!.notes.join()).toContain("7");
  });

  it("يصدّر CSV بـ BOM ويهرب الفواصل، وMarkdown بجدول", () => {
    const entries = buildDictionary(report([col({ name: "a,b", distinctCount: 3 })]));
    const csv = dictionaryToCsv(entries);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"a,b"');
    expect(dictionaryToMarkdown(entries)).toContain("| العمود |");
  });
});
