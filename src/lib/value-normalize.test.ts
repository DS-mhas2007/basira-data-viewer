import { describe, expect, it } from "vitest";
import {
  detectNumberLocale,
  isScientificColumn,
  parseNamedMonthDate,
  parseNumericValue,
  stripInvisible,
} from "./value-normalize";

describe("detectNumberLocale", () => {
  it("يتعرّف على الفاصلة العشرية من العمود كله", () => {
    expect(detectNumberLocale(["3,5", "4,25", "2"])).toBe("eu");
    expect(detectNumberLocale(["1.234,56", "980,10"])).toBe("eu");
    expect(detectNumberLocale(["0,500", "12"])).toBe("eu");
  });
  it("يبقي الفاصلة آلافاً حين تدل القرائن على ذلك", () => {
    expect(detectNumberLocale(["1,234,567", "89"])).toBe("us");
    expect(detectNumberLocale(["1,234.50", "2,000.00"])).toBe("us");
  });
  it("1,234 وحدها غامضة فتبقى آلافاً (السلوك الحالي)", () => {
    expect(detectNumberLocale(["1,234", "5,678"])).toBe("us");
  });
  it("الخلط بين الصيغتين يُعلَن تعارضاً ولا يُخمَّن", () => {
    expect(detectNumberLocale(["3,5", "1,234,567"])).toBe("conflict");
    expect(detectNumberLocale(["3,5", "2.75"])).toBe("conflict");
  });
});

describe("parseNumericValue", () => {
  it("نمط eu", () => {
    expect(parseNumericValue("3,5", { locale: "eu" })?.value).toBe(3.5);
    expect(parseNumericValue("1.234,56", { locale: "eu" })?.value).toBe(1234.56);
    expect(parseNumericValue("1.234", { locale: "eu" })?.value).toBe(1234);
    expect(parseNumericValue("-0,5", { locale: "eu" })?.value).toBe(-0.5);
    expect(parseNumericValue("12,5%", { locale: "eu" })).toMatchObject({ value: 12.5, isPercent: true });
  });
  it("بدون نمط: 3,5 يبقى نصاً (لا يصير 35)", () => {
    expect(parseNumericValue("3,5")).toBeNull();
  });
  it("الأصفار البادئة تبقى نصاً حتى في eu", () => {
    expect(parseNumericValue("007,5", { locale: "eu" })).toBeNull();
  });
  it("الصيغة العلمية لا تعمل إلا بطلب العمود", () => {
    expect(parseNumericValue("1.5e3")).toBeNull();
    expect(parseNumericValue("1.5e3", { scientific: true })?.value).toBe(1500);
    expect(parseNumericValue("3.2e-2", { scientific: true })?.value).toBeCloseTo(0.032);
    expect(parseNumericValue("007E2", { scientific: true })).toBeNull();
  });
  it("يزيل العلامات الخفية قبل التحليل", () => {
    expect(parseNumericValue("25‏")?.value).toBe(25);
  });
});

describe("isScientificColumn", () => {
  it("عمود علمي بالكامل", () => expect(isScientificColumn(["1.5e3", "2E4", "7"])).toBe(true));
  it("أكواد مختلطة مع نص لا تُحوَّل (مثل 12E3 بين أسماء)", () =>
    expect(isScientificColumn(["12E3", "AB-7", "C9"])).toBe(false));
  it("لا علمي إطلاقاً → false", () => expect(isScientificColumn(["1", "2"])).toBe(false));
});

describe("parseNamedMonthDate", () => {
  it.each([
    ["12 مايو 2024", "2024-05-12"],
    ["٥ يونيو ٢٠٢٤", "2024-06-05"],
    ["30 أبريل 2024", "2024-04-30"],
    ["30 ابريل 2024", "2024-04-30"],
    ["15 كانون الثاني 2023", "2023-01-15"],
    ["3 تشرين الأول 2023", "2023-10-03"],
    ["1 آب 2022", "2022-08-01"],
    ["May 12, 2024", "2024-05-12"],
    ["12-May-2024", "2024-05-12"],
    ["12 Sept 2024", "2024-09-12"],
    ["Dec 1st, 2024", "2024-12-01"],
    ["12 مايو 2024 14:30", "2024-05-12 14:30"],
  ])("%s → %s", (input, out) => expect(parseNamedMonthDate(input)).toBe(out));

  it("يرفض التواريخ المستحيلة والنصوص العادية", () => {
    expect(parseNamedMonthDate("31 أبريل 2024")).toBeNull();
    expect(parseNamedMonthDate("29 فبراير 2023")).toBeNull();
    expect(parseNamedMonthDate("12 غير 2024")).toBeNull();
    expect(parseNamedMonthDate("hello world")).toBeNull();
    expect(parseNamedMonthDate("12 مايو 24")).toBeNull(); // سنة من خانتين: لا نخمّن القرن
  });
});

describe("stripInvisible", () => {
  it("يحذف علامات الاتجاه ويُبقي الحروف", () => {
    expect(stripInvisible("العمر‏")).toBe("العمر");
    expect(stripInvisible("‫أحمد‬")).toBe("أحمد");
    expect(stripInvisible("a⁦b⁩")).toBe("ab");
  });
});
