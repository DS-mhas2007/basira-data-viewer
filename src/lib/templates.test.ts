import { describe, expect, it } from "vitest";
import { measureScore, pickColumns } from "./templates";
import type { TableInfo } from "@/lib/duckdb-service";

const info = (cols: [string, string][]) =>
  ({ schema: cols.map(([name, type]) => ({ name, type })) }) as unknown as TableInfo;

describe("pickColumns measure", () => {
  it("يفضّل revenue على quantity وسعر الوحدة", () => {
    const r = pickColumns(
      info([
        ["order_id", "VARCHAR"],
        ["order_date", "DATE"],
        ["category", "VARCHAR"],
        ["quantity", "BIGINT"],
        ["unit_price", "DOUBLE"],
        ["revenue", "DOUBLE"],
      ]),
    );
    expect(r.measure).toBe("revenue");
    expect(r.cat).toBe("category");
    expect(r.date).toBe("order_date");
  });
  it("السعر قبل الكمية عند غياب الإجمالي", () => {
    expect(pickColumns(info([["quantity", "INTEGER"], ["price", "DOUBLE"]])).measure).toBe("price");
  });
  it("يستخدم الكمية إن لم يوجد غيرها", () => {
    expect(pickColumns(info([["name", "VARCHAR"], ["quantity", "INTEGER"]])).measure).toBe("quantity");
  });
  it("يحتفظ بالترتيب الأصلي عند تساوي الأولوية", () => {
    expect(pickColumns(info([["height", "DOUBLE"], ["weight", "DOUBLE"]])).measure).toBe("height");
  });
  it("أسماء عربية", () => {
    expect(measureScore("إجمالي المبيعات")).toBe(3);
    expect(measureScore("الكمية")).toBe(0);
  });
});
