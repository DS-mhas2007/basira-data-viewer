import { describe, expect, it } from "vitest";
import { DEFAULT_REPORT_TEMPLATE, REPORT_TEMPLATES, isReportTemplateId } from "./report-template";

describe("report templates", () => {
  it("has meta for every id and a valid default", () => {
    expect(Object.keys(REPORT_TEMPLATES).sort()).toEqual([
      "brief",
      "classic",
      "modern",
      "narrative",
    ]);
    expect(isReportTemplateId(DEFAULT_REPORT_TEMPLATE)).toBe(true);
  });
  it("rejects unknown ids", () => {
    expect(isReportTemplateId("fancy")).toBe(false);
    expect(isReportTemplateId(null)).toBe(false);
  });
});
