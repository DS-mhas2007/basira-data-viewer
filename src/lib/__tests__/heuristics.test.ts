import { describe, it, expect } from "vitest";
import { isDateColumn } from "../profile";
import { AGE_RE } from "../anomaly-radar";
import { toCsv } from "../data-export";
import { columnExpr, type CleanStep } from "../cleaning";

describe("isDateColumn name matching", () => {
  it.each(["order_date", "date", "created_at_time", "Year", "orderDate", "تاريخ_الطلب"])("matches %s", (n) =>
    expect(isDateColumn("VARCHAR", n)).toBe(true),
  );
  it.each(["years_experience", "monthly_salary", "runtime", "update", "daytona", "timeout"])("does not match %s", (n) =>
    expect(isDateColumn("INTEGER", n)).toBe(false),
  );
  it("still trusts the column type", () => expect(isDateColumn("TIMESTAMP", "x")).toBe(true));
});

describe("AGE_RE", () => {
  it.each(["age", "Age", "age_group", "customer_age", "userAge", "العمر"])("matches %s", (n) =>
    expect(AGE_RE.test(n)).toBe(true),
  );
  it.each(["percentage", "average", "usage", "language", "page", "image"])("does not match %s", (n) =>
    expect(AGE_RE.test(n)).toBe(false),
  );
});

describe("toCsv formula injection", () => {
  it("neutralises leading = + - @ in text", () => {
    const csv = toCsv(["v"], [{ v: "=HYPERLINK(\"x\")" }, { v: "+1+1" }, { v: "@SUM(A1)" }, { v: "-cmd" }]);
    const lines = csv.split("\r\n").slice(1);
    for (const l of lines) expect(l.replace(/^"/, "")).toMatch(/^'/);
  });
  it("keeps real numbers untouched", () => {
    expect(toCsv(["v"], [{ v: -5 }, { v: "-5.5" }, { v: 3 }])).toBe("v\r\n-5\r\n-5.5\r\n3");
  });
});

describe("cleaning SQL", () => {
  it("trim step strips tabs and newlines, not only spaces", () => {
    const step = { kind: "trim", params: { textColumns: ["c"] } } as unknown as CleanStep;
    expect(columnExpr(step, "c")).toContain("'^\\s+|\\s+$'");
  });
});
