import { describe, it, expect, vi } from "vitest";

// test-setup.ts يستبدل xlsx بـ mock عام؛ هنا نحتاج المكتبة الحقيقية لقراءة ملف فعلي
vi.unmock("xlsx");
import * as XLSX from "xlsx";
import { parseNumericValue } from "../value-normalize";
import { parseFile } from "../parse-file";

const num = (v: string) => parseNumericValue(v)?.value;

describe("parseNumericValue keeps identifiers as text", () => {
  it("leading zeros", () => {
    expect(parseNumericValue("007")).toBeNull();
    expect(parseNumericValue("0501234567")).toBeNull();
  });
  it("international phone numbers", () => expect(parseNumericValue("+966501234567")).toBeNull());
  it("ids beyond 15 digits", () => expect(parseNumericValue("12345678901234567890")).toBeNull());
  it("decimal comma is not silently turned into thousands", () => expect(parseNumericValue("3,5")).toBeNull());
});

describe("parseNumericValue still parses real numbers", () => {
  it("plain / decimals", () => {
    expect(num("42")).toBe(42);
    expect(num("0.5")).toBe(0.5);
    expect(num(".5")).toBe(0.5);
    expect(num("-12.75")).toBe(-12.75);
  });
  it("thousands separators", () => {
    expect(num("1,234")).toBe(1234);
    expect(num("1,234,567.89")).toBe(1234567.89);
  });
  it("arabic digits", () => expect(num("١٢٣٤")).toBe(1234));
  it("percent, currency, parentheses", () => {
    expect(parseNumericValue("15%")).toMatchObject({ value: 15, isPercent: true });
    expect(parseNumericValue("$1,200")).toMatchObject({ value: 1200, unit: "$" });
    expect(num("(500)")).toBe(-500);
  });
  it("rejects text", () => {
    expect(parseNumericValue("abc")).toBeNull();
    expect(parseNumericValue("")).toBeNull();
    expect(parseNumericValue("1,23,4")).toBeNull();
  });
});

function csvFile(text: string, name = "t.csv") {
  const f = new File([text], name);
  if (!f.arrayBuffer) (f as any).arrayBuffer = async () => new TextEncoder().encode(text).buffer;
  return f;
}

describe("parseFile csv", () => {
  it("preserves leading zeros in a column", async () => {
    const r = await parseFile(csvFile("id,phone\n1,0501234567\n2,0509999999"));
    expect(r.sheets["البيانات"]!.rows[0]!["phone"]).toBe("0501234567");
  });
  it("rejects an unclosed quote instead of swallowing the file", async () => {
    await expect(parseFile(csvFile('a,b\n1,"unclosed\n4,5\n6,7'))).rejects.toThrow(/اقتباس/);
  });
});

describe("parseFile xlsx", () => {
  it("converts date cells to ISO text, not serial numbers", async () => {
    // أرقام تسلسلية Excel دقيقة (45306 = 2024-01-15) مع تنسيق تاريخ، كما في ملف حقيقي
    const ws = XLSX.utils.aoa_to_sheet([["name", "joined", "amount"], ["a", 45306, 10.5], ["b", 45325, 20]]);
    for (const addr of ["B2", "B3"]) ws[addr]!.z = "yyyy-mm-dd";
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "S");
    const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const f = new File([buf], "t.xlsx");
    if (!f.arrayBuffer) (f as any).arrayBuffer = async () => buf;
    const r = await parseFile(f);
    const rows = r.sheets["S"]!.rows;
    expect(rows[0]!["joined"]).toBe("2024-01-15");
    expect(rows[1]!["joined"]).toBe("2024-02-03");
    expect(rows[0]!["amount"]).toBe(10.5);
  });
});
