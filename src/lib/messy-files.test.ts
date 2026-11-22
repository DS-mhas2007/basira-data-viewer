// @vitest-environment node
/**
 * مكتبة الملفات الغريبة: كل ملف في __fixtures__/messy يمر عبر parseFile ويُقارَن بتوقعات manifest.json.
 *  - ok:     السلوك الحالي مقبول ويجب ألا ينكسر.
 *  - gap:    فجوة معروفة. it.fails يمرّ طالما الفجوة قائمة، وعند إصلاحها يفشل فحوّل الحالة إلى ok في المولِّد.
 *  - throws: يجب أن يُرفض الملف برسالة تحتوي النص المذكور.
 * أضف حالة جديدة بتعديل scripts/generate-messy-fixtures.py ثم شغّله.
 */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// test-setup.ts يستبدل xlsx بنسخة وهمية؛ هنا نحتاج المكتبة الحقيقية لقراءة ملفات Excel الفعلية.
vi.unmock("xlsx");
import { parseFile } from "./parse-file";

const DIR = new URL("./__fixtures__/messy/", import.meta.url);

interface CellCheck {
  row: number;
  col: string;
  value: unknown;
}
interface Expect {
  throws?: string;
  sheet?: string;
  sheetNames?: string[];
  columns?: string[];
  columnCount?: number;
  rowCount?: number;
  distinctColumns?: boolean;
  encoding?: string;
  delimiter?: string;
  skippedTitleRows?: number;
  warnings?: string[];
  cells?: CellCheck[];
  cellsNot?: CellCheck[];
  meta?: { col: string; is: Record<string, unknown> }[];
  rowValueSet?: { row: number; values: unknown[] };
}
interface Case {
  id: string;
  title: string;
  file: string;
  status: "ok" | "gap" | "throws";
  expect: Expect;
}

const cases = JSON.parse(readFileSync(new URL("manifest.json", DIR), "utf8")) as Case[];

function load(file: string): File {
  return new File([new Uint8Array(readFileSync(new URL(file, DIR)))], file);
}

// واجهة مرنة: نقرأ الحقول التي نحتاجها فقط، فلا نربط الاختبار بكل تفاصيل أنواع parse-file.
type Loose = {
  sheetNames: string[];
  sheets: Record<
    string,
    { columns: string[]; rows: Record<string, unknown>[]; columnMeta?: Record<string, Record<string, unknown>> }
  >;
  meta?: { encoding?: string; delimiter?: string; skippedTitleRows?: number; warnings?: string[] };
};

function check(parsed: Loose, e: Expect) {
  const name = e.sheet ?? parsed.sheetNames[0] ?? "";
  const sheet = parsed.sheets[name];
  expect(sheet, `الورقة «${name}» غير موجودة`).toBeDefined();
  if (!sheet) return;

  if (e.sheetNames) expect(parsed.sheetNames).toEqual(e.sheetNames);
  if (e.columns) expect(sheet.columns).toEqual(e.columns);
  if (e.columnCount != null) expect(sheet.columns).toHaveLength(e.columnCount);
  if (e.rowCount != null) expect(sheet.rows).toHaveLength(e.rowCount);
  if (e.distinctColumns) expect(new Set(sheet.columns).size).toBe(sheet.columns.length);
  if (e.encoding) expect(parsed.meta?.encoding).toBe(e.encoding);
  if (e.delimiter) expect(parsed.meta?.delimiter).toBe(e.delimiter);
  if (e.skippedTitleRows != null) expect(parsed.meta?.skippedTitleRows).toBe(e.skippedTitleRows);
  for (const w of e.warnings ?? []) expect((parsed.meta?.warnings ?? []).join(" | ")).toContain(w);
  for (const c of e.cells ?? []) expect(sheet.rows[c.row]?.[c.col], `${c.col}[${c.row}]`).toEqual(c.value);
  for (const c of e.cellsNot ?? []) expect(sheet.rows[c.row]?.[c.col], `${c.col}[${c.row}]`).not.toEqual(c.value);
  for (const m of e.meta ?? []) expect(sheet.columnMeta?.[m.col], `meta ${m.col}`).toMatchObject(m.is);
  if (e.rowValueSet) {
    const row = sheet.rows[e.rowValueSet.row] ?? {};
    const got = sheet.columns.map((c) => row[c]).sort();
    expect(got).toEqual([...e.rowValueSet.values].sort());
  }
}

describe("مكتبة الملفات الغريبة", () => {
  it("المانيفست سليم: معرّفات فريدة وكل ملف موجود", () => {
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases) expect(existsSync(new URL(c.file, DIR)), c.file).toBe(true);
  });

  for (const c of cases) {
    const run = async () => {
      if (c.status === "throws") {
        await expect(parseFile(load(c.file))).rejects.toThrow(c.expect.throws ?? "");
        return;
      }
      check((await parseFile(load(c.file))) as unknown as Loose, c.expect);
    };
    if (c.status === "gap") it.fails(`[فجوة] ${c.id}: ${c.title}`, run);
    else it(`${c.id}: ${c.title}`, run);
  }
});
