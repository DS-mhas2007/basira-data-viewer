import { describe, expect, it } from "vitest";
import { starterBoard } from "./dashboard-board";
import type { TableInfo } from "@/lib/duckdb-service";

const info = (cols: [string, string][]) =>
  ({ schema: cols.map(([name, type]) => ({ name, type })) }) as unknown as TableInfo;

describe("starterBoard", () => {
  const sales = info([
    ["order_id", "VARCHAR"],
    ["customer_id", "BIGINT"],
    ["order_date", "DATE"],
    ["category", "VARCHAR"],
    ["channel", "VARCHAR"],
    ["quantity", "BIGINT"],
    ["unit_price", "DOUBLE"],
    ["revenue", "DOUBLE"],
  ]);

  it("يستخدم revenue كمقياس والفئة الحقيقية لا المعرّف", () => {
    const w = starterBoard(sales);
    expect(w[0]!.config.x).toBe("category");
    expect(w[0]!.config.y).toBe("revenue");
  });
  it("الرسم الزمني بلا حد (كل التواريخ)", () => {
    const area = starterBoard(sales).find((x) => x.config.kind === "area")!;
    expect(area.config.x).toBe("order_date");
    expect(area.config.limit).toBe(0);
  });
  it("لا يستخدم معرّفاً كمقياس أو كفئة", () => {
    for (const w of starterBoard(sales)) {
      expect(w.config.x).not.toMatch(/_id$/);
      expect(w.config.y).not.toMatch(/_id$/);
    }
  });
  it("المقياس الثاني متوسط عمود مختلف", () => {
    const avg = starterBoard(sales).find((x) => x.config.agg === "AVG")!;
    expect(avg.config.y).not.toBe("revenue");
    expect(avg.config.kind).toBe("bar");
  });
});
