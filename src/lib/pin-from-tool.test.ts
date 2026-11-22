import { describe, expect, it } from "vitest";
import { pinnedFromToolOutput } from "./agent-chat-tools";

describe("pinnedFromToolOutput", () => {
  const ok = {
    ok: true,
    sql: 'SELECT department, AVG(salary) AS avg_salary FROM "dataset" GROUP BY 1',
    rows: [{ department: "HR", avg_salary: 20330 }],
    extra: { title_ar: "متوسط الراتب حسب القسم", intent: "compare", chart: { type: "bar", x: "department", y: ["avg_salary"], series: null } },
  };
  it("builds a pinnable insight with a stable id", () => {
    const a = pinnedFromToolOutput(ok)!;
    const b = pinnedFromToolOutput(ok)!;
    expect(a.evidence.id).toBe(b.evidence.id);
    expect(a.evidence.title).toBe("متوسط الراتب حسب القسم");
    expect(a.plan.chart.type).toBe("bar");
    expect(a.rows).toHaveLength(1);
  });
  it("returns null for failed, empty, or SQL-less outputs", () => {
    expect(pinnedFromToolOutput({ ok: false, sql: "x", rows: [{ a: 1 }] })).toBeNull();
    expect(pinnedFromToolOutput({ ok: true, sql: "x", rows: [] })).toBeNull();
    expect(pinnedFromToolOutput({ ok: true, rows: [{ a: 1 }] })).toBeNull();
    expect(pinnedFromToolOutput(undefined)).toBeNull();
  });
  it("falls back to a table chart and summary intent", () => {
    const p = pinnedFromToolOutput({ ok: true, sql: "SELECT 1", rows: [{ a: 1 }] })!;
    expect(p.plan.intent).toBe("summary");
    expect(p.plan.chart.type).toBe("table");
  });
});
