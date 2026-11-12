import { describe, it, expect } from "vitest";
import { columnExpr, dateFormats, makeDateStep } from "../cleaning";

describe("dateFormats", () => {
  it("dmy never contains month-first slash formats", () => {
    const f = dateFormats("dmy");
    expect(f).toContain("%d/%m/%Y");
    expect(f).not.toContain("%m/%d/%Y");
  });
  it("mdy never contains day-first slash formats", () => {
    const f = dateFormats("mdy");
    expect(f).toContain("%m/%d/%Y");
    expect(f).not.toContain("%d/%m/%Y");
  });
  it("both keep ISO formats", () => {
    for (const o of ["dmy", "mdy"] as const) {
      expect(dateFormats(o)).toEqual(expect.arrayContaining(["%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%dT%H:%M:%S"]));
    }
  });
});

describe("date step carries the chosen order into SQL", () => {
  it("defaults to day/month", () => {
    const step = makeDateStep(["d"], "d", 5);
    expect(step.params.dateOrder).toBe("dmy");
    expect(columnExpr(step, "d")).toContain("'%d/%m/%Y'");
    expect(columnExpr(step, "d")).not.toContain("'%m/%d/%Y'");
  });
  it("month/day when chosen, and says so in the label", () => {
    const step = makeDateStep(["d"], "d", 5, "mdy");
    expect(step.label).toContain("شهر/يوم");
    expect(columnExpr(step, "d")).toContain("'%m/%d/%Y'");
    expect(columnExpr(step, "d")).not.toContain("'%d/%m/%Y'");
  });
  it("leaves other columns untouched", () => {
    expect(columnExpr(makeDateStep(["d", "e"], "d", 1), "e")).toBe('"e"');
  });
});
