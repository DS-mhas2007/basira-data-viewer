import { describe, expect, it } from "vitest";
import { extractNumbers, findUnsupportedNumbers } from "./answer-numbers-check";

describe("answer-numbers-check", () => {
  it("reads Arabic-Indic digits and thousands separators", () => {
    expect(extractNumbers("المجموع ١٢٬٣٤٥ و 1,234.5")).toEqual([12345, 1234.5]);
  });

  it("accepts rounded numbers that come from tool output", () => {
    const tool = JSON.stringify([{ total: 28684.399999999998 }]);
    expect(findUnsupportedNumbers("الإجمالي 28684.4 وحدة", [tool])).toEqual([]);
  });

  it("flags numbers that no tool produced", () => {
    const tool = JSON.stringify([{ total: 500 }]);
    expect(findUnsupportedNumbers("الإجمالي 500 والنمو 4321", [tool])).toEqual(["4321"]);
  });

  it("ignores small counts and years", () => {
    expect(findUnsupportedNumbers("في عام 2012 ظهرت 3 فئات", [])).toEqual([]);
  });
});

describe("answer-numbers-check: strengthened", () => {
  const tool = JSON.stringify([{ avg: 4.73, total: 28684.4, share: 0.235, n: 1200000 }]);

  it("checks small decimals (averages below 10)", () => {
    expect(findUnsupportedNumbers("المتوسط 4.7", [tool])).toEqual([]);
    expect(findUnsupportedNumbers("المتوسط 6.2", [tool])).toEqual(["6.2"]);
  });

  it("checks small integer percentages but not plain small counts", () => {
    expect(findUnsupportedNumbers("حصة 8% فقط", [tool])).toEqual(["8"]);
    expect(findUnsupportedNumbers("ظهرت 3 فئات", [tool])).toEqual([]);
  });

  it("accepts percent derived from a fraction in the source", () => {
    expect(findUnsupportedNumbers("النسبة 23.5%", [tool])).toEqual([]);
    expect(findUnsupportedNumbers("النسبة 25%", [tool])).toEqual(["25"]);
  });

  it("understands scale words (ألف / مليون)", () => {
    expect(findUnsupportedNumbers("الإجمالي 28.7 ألف", [tool])).toEqual([]);
    expect(findUnsupportedNumbers("العدد 1.2 مليون", [tool])).toEqual([]);
    expect(findUnsupportedNumbers("العدد 2.5 مليون", [tool])).toEqual(["2.5"]);
  });

  it("ignores years only in year context, not when it is a quantity", () => {
    expect(findUnsupportedNumbers("في عام 2024 ارتفعت", [])).toEqual([]);
    expect(findUnsupportedNumbers("منذ 2019", [])).toEqual([]);
    expect(findUnsupportedNumbers("في 2023 كانت المبيعات مرتفعة", [])).toEqual([]);
    expect(findUnsupportedNumbers("الفترة 2024-05", [])).toEqual([]);
    expect(findUnsupportedNumbers("بلغ المجموع 2024 طلباً", [])).toEqual(["2024"]);
    expect(findUnsupportedNumbers("في 2024 طلباً", [])).toEqual(["2024"]);
    expect(findUnsupportedNumbers("الإجمالي 2024", [])).toEqual(["2024"]);
  });
});
