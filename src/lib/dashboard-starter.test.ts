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
    const bar = starterBoard(sales).find((x) => x.config.kind === "bar" && x.config.agg === "SUM")!;
    expect(bar.config.x).toBe("category");
    expect(bar.config.y).toBe("revenue");
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
  it("يرتّب اللوحة تحريرياً: دونات صغير + منحنى عريض ثم عمودان متقابلان بلا تداخل", () => {
    const w = starterBoard(sales);
    const pie = w.find((x) => x.config.kind === "pie")!;
    const area = w.find((x) => x.config.kind === "area")!;
    expect(pie.layout).toMatchObject({ x: 0, y: 0, w: 4 });
    expect(area.layout).toMatchObject({ x: 4, y: 0, w: 8 });
    const bars = w.filter((x) => x.config.kind === "bar");
    expect(bars.map((b) => b.layout!.w)).toEqual([7, 5]);
    for (const a of w)
      for (const b of w) {
        if (a === b) continue;
        const overlap =
          a.layout!.x < b.layout!.x + b.layout!.w &&
          a.layout!.x + a.layout!.w > b.layout!.x &&
          a.layout!.y < b.layout!.y + b.layout!.h &&
          a.layout!.y + a.layout!.h > b.layout!.y;
        expect(overlap).toBe(false);
      }
  });
});
