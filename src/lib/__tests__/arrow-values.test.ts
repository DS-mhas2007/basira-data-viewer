import { describe, it, expect } from "vitest";
import { convertCell, decimalToValue, ARROW_DATE, ARROW_DECIMAL, ARROW_TIME, ARROW_TIMESTAMP } from "../arrow-values";

describe("decimalToValue", () => {
  it.each([
    ["150", 2, 1.5],
    ["-12345678", 3, -12345.678],
    ["5", 0, 5],
    ["5", 3, 0.005],
    ["-5", 3, -0.005],
    ["100", 2, 1],
    ["0", 2, 0],
    ["12", -2, 1200],
  ])("%s scale %i -> %s", (u, s, expected) => expect(decimalToValue(u, s)).toBe(expected));
  it("keeps full precision as text beyond 15 digits", () => {
    expect(decimalToValue("1234567890123456789012345", 1)).toBe("123456789012345678901234.5");
  });
});

describe("convertCell", () => {
  it("DATE -> ISO date", () => expect(convertCell(ARROW_DATE, undefined, 1705276800000)).toBe("2024-01-15"));
  it("TIMESTAMP -> ISO datetime without .000", () => {
    expect(convertCell(ARROW_TIMESTAMP, undefined, 1705314645000)).toBe("2024-01-15 10:30:45");
    expect(convertCell(ARROW_TIMESTAMP, undefined, 1705314645123)).toBe("2024-01-15 10:30:45.123");
  });
  it("DECIMAL from the quoted form DuckDB-WASM returns", () => {
    expect(convertCell(ARROW_DECIMAL, 2, '"150"')).toBe(1.5);
    expect(convertCell(ARROW_DECIMAL, 3, '"-12345678"')).toBe(-12345.678);
  });
  it("TIME micros -> HH:MM:SS", () => expect(convertCell(ARROW_TIME, undefined, "37800000000n")).toBe("10:30:00"));
  it("passes through ordinary values and converts bigint", () => {
    expect(convertCell(undefined, undefined, 5n)).toBe(5);
    expect(convertCell(undefined, undefined, "x")).toBe("x");
    expect(convertCell(undefined, undefined, null)).toBeNull();
    expect(convertCell(ARROW_DATE, undefined, null)).toBeNull();
  });
});
