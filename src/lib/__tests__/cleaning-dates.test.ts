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


describe("KNN materialization cache identity", () => {
  it("does not reuse a cached result when source content changes under the same relation and params", async () => {
    const { buildKnnCacheSignature } = await import("../knn-impute");
    const params = {
      allColumns: ["id", "value"],
      column: "value",
      columnType: "DOUBLE",
      features: ["id"],
      k: 5,
    };
    const sourceA = { alias: "sales", contentFingerprint: "content-v1:sha256:aaa", sourceRevision: 4 };
    const sourceB = { alias: "sales", contentFingerprint: "content-v1:sha256:bbb", sourceRevision: 5 };

    const signatureA = buildKnnCacheSignature("SELECT * FROM dataset", params, sourceA, 12);
    const sameSnapshot = buildKnnCacheSignature("SELECT * FROM dataset", params, sourceA, 12);
    const signatureB = buildKnnCacheSignature("SELECT * FROM dataset", params, sourceB, 13);

    expect(signatureA).toBe(sameSnapshot);
    expect(signatureA).not.toBe(signatureB);
  });

  it("does not reuse a cached result after the active relation revision changes", async () => {
    const { buildKnnCacheSignature } = await import("../knn-impute");
    const params = { allColumns: ["value"], column: "value", columnType: "DOUBLE", features: [], k: 3 };
    const source = { alias: "sales", contentFingerprint: "content-v1:sha256:aaa", sourceRevision: 4 };

    expect(buildKnnCacheSignature("SELECT * FROM dataset", params, source, 12))
      .not.toBe(buildKnnCacheSignature("SELECT * FROM dataset", params, source, 13));
  });
});
