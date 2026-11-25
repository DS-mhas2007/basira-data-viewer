// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildHtmlReport, type HtmlReportInput } from "./html-report";

const ins = (n: number) =>
  ({
    evidence: {
      id: `e${n}`,
      title: `استنتاج ${n}`,
      sql: `SELECT secret_${n} FROM data`,
      filters: [],
      baseRowCount: 10,
      resultRowCount: 2,
      highlights: [],
      warnings: [],
    },
    plan: {
      intent: "ranking",
      title_ar: `استنتاج ${n}`,
      sql: "",
      intro_ar: "",
      analysis_ar: "تحليل",
      chart: { type: "bar", x: "a", y: ["b"], series: null },
      explanation_plan: [],
      warnings: [],
      needs_clarification: false,
      clarification_question: null,
    },
    rows: [
      { a: "x", b: 2 },
      { a: "y", b: 1 },
    ],
  }) as never;

const base = (template: HtmlReportInput["template"]): HtmlReportInput =>
  ({
    fileName: "f.csv",
    health: null,
    rowCount: 10,
    columnCount: 2,
    cleanSteps: [],
    insights: [ins(1), ins(2), ins(3), ins(4)],
    signals: [],
    seal: null,
    playbook: null,
    template,
  }) as HtmlReportInput;

describe("html report templates", () => {
  it("classic keeps tables and SQL", () => {
    const h = buildHtmlReport(base("classic"));
    expect(h).toContain("<table");
    expect(h).toContain("secret_1");
  });
  it("brief drops tables/SQL and keeps 3 insights", () => {
    const h = buildHtmlReport(base("brief"));
    expect(h).not.toContain("<table");
    expect(h).not.toContain("secret_1");
    expect(h).toContain("استنتاج 3");
    expect(h).not.toContain("استنتاج 4");
  });
  it("narrative labels chapters without tables/SQL", () => {
    const h = buildHtmlReport(base("narrative"));
    expect(h).toContain("الفصل 4: استنتاج 4");
    expect(h).not.toContain("secret_2");
  });
});
