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
