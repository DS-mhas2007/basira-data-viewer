import { describe, expect, it } from "vitest";
import { normalizeChartRows } from "../chart-studio";

describe("normalizeChartRows", () => {
  it("keeps valid numeric values, including zero and numeric strings", () => {
    expect(
      normalizeChartRows([
        { label: "zero", value: 0 },
        { label: "positive", value: 12.5 },
        { label: "text number", value: "8" },
      ]),
    ).toEqual({
      points: [
        { label: "zero", value: 0 },
        { label: "positive", value: 12.5 },
        { label: "text number", value: 8 },
      ],
      omitted: 0,
    });
  });

  it("does not turn missing, invalid, boolean, or non-finite values into zero", () => {
    expect(
      normalizeChartRows([
        { label: "null", value: null },
        { label: "undefined", value: undefined },
        { label: "empty", value: "" },
        { label: "invalid", value: "not-a-number" },
        { label: "boolean", value: false },
        { label: "infinite", value: Infinity },
        { label: "date", value: new Date("2026-01-01") },
      ]),
    ).toEqual({ points: [], omitted: 7 });
  });

  it("omits BigInt values that cannot be represented safely as Number", () => {
    expect(
      normalizeChartRows([
        { label: "safe", value: 42n },
        { label: "unsafe", value: 9007199254740993n },
      ]),
    ).toEqual({
      points: [{ label: "safe", value: 42 }],
      omitted: 1,
    });
  });

  it("uses a readable fallback for missing labels", () => {
    expect(normalizeChartRows([{ value: 3 }]).points).toEqual([
      { label: "—", value: 3 },
    ]);
  });
});
