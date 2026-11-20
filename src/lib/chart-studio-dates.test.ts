import { describe, expect, it } from "vitest";
import {
  buildSql,
  defaultConfig,
  detectDateFormat,
  safeDateFormat,
  validateChartPoints,
} from "./chart-studio";
import { sqlResultWarnings } from "./agent-chat-tools";
import type { TableInfo } from "./duckdb-service";

const info = {
  table: "dataset",
  rowCount: 10,
  schema: [
    { name: "OrderDate", type: "VARCHAR" },
    { name: "Sales", type: "DOUBLE" },
  ],
} as unknown as TableInfo;

describe("detectDateFormat", () => {
  it("detects the time-first text format from the screenshots", () => {
    const g = detectDateFormat(["0:00 7/4/2012", "0:00 8/15/2012", "0:00 1/2/2013"]);
    expect(g?.format).toBe("%H:%M %m/%d/%Y");
  });

  it("switches to day-first when the first part exceeds 12", () => {
    const g = detectDateFormat(["25/12/2020", "03/01/2021"]);
    expect(g?.format).toBe("%d/%m/%Y");
    expect(g?.ambiguous).toBe(false);
  });

  it("flags ambiguous day/month samples", () => {
    expect(detectDateFormat(["01/02/2020", "03/04/2020"])?.ambiguous).toBe(true);
  });

  it("returns null for non-date text", () => {
    expect(detectDateFormat(["Apple", "Banana", "Cherry"])).toBeNull();
  });
});

describe("buildSql with text dates", () => {
  it("parses with TRY_STRPTIME and groups by period", () => {
    const sql = buildSql(info, {
      ...defaultConfig(info),
      x: "OrderDate",
      y: "Sales",
      kind: "line",
      agg: "SUM",
      bucket: "month",
      dateFormat: "%m/%d/%Y",
      sort: "label_asc",
      limit: 0,
    });
    expect(sql).toContain("TRY_STRPTIME");
    expect(sql).toContain("strftime(CAST(TRY_STRPTIME");
    expect(sql).toContain("GROUP BY 1");
    expect(sql).toContain("ORDER BY 1 ASC");
  });

  it("rejects unsafe date formats", () => {
    expect(safeDateFormat("%Y'); DROP TABLE x;--")).toBeNull();
    expect(safeDateFormat("%Y-%m-%d")).toBe("%Y-%m-%d");
  });
});

describe("validateChartPoints", () => {
  it("rejects empty results and impossible years", () => {
    expect(validateChartPoints([], { temporal: true, kind: "line" }).ok).toBe(false);
    const bad = validateChartPoints(
      [{ label: "0001-01", value: 1 }, { label: "2012-04", value: 2 }],
      { temporal: true, kind: "line" },
    );
    expect(bad.ok).toBe(false);
  });

  it("accepts a normal monthly series", () => {
    const ok = validateChartPoints(
      [{ label: "2012-01", value: 1 }, { label: "2012-02", value: 2 }],
      { temporal: true, kind: "line" },
    );
    expect(ok.ok).toBe(true);
  });
});

describe("sqlResultWarnings", () => {
  it("warns on empty, all-NULL and repeated date results", () => {
    expect(sqlResultWarnings([])).toHaveLength(1);
    expect(sqlResultWarnings([{ a: null }, { a: null }])[0]).toContain("NULL");
    const repeated = sqlResultWarnings([
      { d: "2012-04-07", v: 1 },
      { d: "2012-04-07", v: 2 },
    ]);
    expect(repeated.join(" ")).toContain("GROUP BY");
  });

  it("is quiet for a clean aggregated result", () => {
    expect(sqlResultWarnings([{ d: "2012-04", v: 1 }, { d: "2012-05", v: 2 }])).toEqual([]);
  });
});

import { sqlResultIssues } from "./agent-chat-tools";

describe("sqlResultIssues", () => {
  it("marks all-NULL and repeated-date results as retryable, empty as not", () => {
    expect(sqlResultIssues([{ a: null }, { a: null }]).some((i) => i.retryable)).toBe(true);
    expect(sqlResultIssues([]).every((i) => !i.retryable)).toBe(true);
    expect(
      sqlResultIssues([{ d: "2012-04-07" }, { d: "2012-04-07" }]).some((i) => i.retryable),
    ).toBe(true);
  });
});
