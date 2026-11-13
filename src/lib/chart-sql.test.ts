import { describe, expect, it } from "vitest";
import { buildSql, defaultConfig } from "./chart-studio";
import type { TableInfo } from "@/lib/duckdb-service";

const info = (cols: [string, string][]) =>
  ({ table: "t", rowCount: 1, schema: cols.map(([name, type]) => ({ name, type })) }) as unknown as TableInfo;

describe("buildSql labels", () => {
  it("يحذف 00:00:00 من تسمية TIMESTAMP", () => {
    const i = info([["d", "TIMESTAMP"], ["v", "DOUBLE"]]);
    const sql = buildSql(i, { ...defaultConfig(i), x: "d", y: "v", agg: "SUM" });
    expect(sql).toContain("regexp_replace(CAST(\"d\" AS VARCHAR), ' 00:00:00$', '')");
  });
  it("لا يغيّر الأنواع الأخرى", () => {
    const i = info([["c", "VARCHAR"], ["v", "DOUBLE"]]);
    const sql = buildSql(i, { ...defaultConfig(i), x: "c", y: "v", agg: "SUM" });
    expect(sql).toContain('CAST("c" AS VARCHAR) AS label');
    expect(sql).not.toContain("regexp_replace");
  });
});

describe("buildSql auto bucket", () => {
  const i = info([["d", "DATE"], ["v", "DOUBLE"], ["c", "VARCHAR"]]);
  it("يجمّع زمنياً للأعمدة الزمنية", () => {
    const sql = buildSql(i, { ...defaultConfig(i), x: "d", y: "v", agg: "SUM", bucket: "auto", sort: "label_asc" });
    expect(sql).toContain("strftime");
    expect(sql).toContain("'%Y-%m'");
    expect(sql).toContain("ORDER BY 1 ASC");
  });
  it("يتجاهل bucket لعمود غير زمني", () => {
    const sql = buildSql(i, { ...defaultConfig(i), x: "c", y: "v", agg: "SUM", bucket: "auto" });
    expect(sql).not.toContain("strftime");
  });
});
