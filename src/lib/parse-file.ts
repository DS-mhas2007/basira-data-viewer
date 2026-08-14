import Papa from "papaparse";
import { isAmbiguousDateColumn, parseNumericValue, toLatinDigits } from "@/lib/value-normalize";

export type Row = Record<string, string | number | boolean | null>;

export interface ColumnMeta {
  /** رمز العملة/الوحدة الغالب في العمود إن وُجد. */
  unit?: string;
  isPercent?: boolean;
  ambiguousDate?: boolean;
}

export interface ParsedSheet {
  columns: string[];
  rows: Row[];
  columnMeta?: Record<string, ColumnMeta>;
}

export interface ParseMeta {
  /** الترميز المكتشف: UTF-8 أو Windows-1256 أو UTF-16LE/BE. */
  encoding: string;
  /** الفاصل المكتشف لملفات CSV. */
  delimiter?: string;
  /** عدد صفوف العناوين التي تم تخطّيها قبل صف الأعمدة. */
  skippedTitleRows?: number;
  warnings: string[];
}

export interface ParsedFile {
  fileName: string;
  fileSize: number;
  sheetNames: string[];
  sheets: Record<string, ParsedSheet>;
  meta?: ParseMeta;
}

export const MAX_FILE_SIZE = 25 * 1024 * 1024;

export const MSG_TOO_LARGE =
  "حجم الملف يتجاوز حدّ النسخة الحالية (25MB). نعالج بياناتك داخل جهازك لحماية خصوصيتها، وهذا الحد يضمن بقاء التحليل سريعاً.";
export const MSG_ENCODING =
  "تعذّرت قراءة النص كـUTF-8. إن كان الملف محفوظاً من Excel على ويندوز، أعد حفظه بصيغة CSV UTF-8 أو اختر «محاولة القراءة بترميز ويندوز العربي».";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function validateFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!["csv", "xlsx"].includes(ext)) {
    return "صيغة الملف غير مدعومة. الرجاء رفع ملف بصيغة CSV أو XLSX.";
  }
  if (file.size === 0) return "الملف فارغ. الرجاء اختيار ملف يحتوي على صفوف بيانات.";
  if (file.size > MAX_FILE_SIZE) return MSG_TOO_LARGE;
  return null;
}

/* ============ الترميز (A1) ============ */

function decodeWith(buffer: ArrayBuffer, label: string): string | null {
  try {
    return new TextDecoder(label, { fatal: false }).decode(buffer);
  } catch {
    return null;
  }
}

function badRatio(text: string): number {
  const bad = text.match(/\uFFFD/g)?.length ?? 0;
  return text.length === 0 ? 1 : bad / text.length;
}

export interface DecodedText {
  text: string;
  encoding: string;
}

/** يكتشف الترميز: UTF-8 → Windows-1256 → UTF-16 (حسب BOM). */
export function decodeBuffer(buffer: ArrayBuffer): DecodedText {
  const head = new Uint8Array(buffer.slice(0, 4));
  if (head[0] === 0xff && head[1] === 0xfe) {
    return { text: decodeWith(buffer, "utf-16le") ?? "", encoding: "UTF-16LE" };
  }
  if (head[0] === 0xfe && head[1] === 0xff) {
    return { text: decodeWith(buffer, "utf-16be") ?? "", encoding: "UTF-16BE" };
  }
  const utf8 = decodeWith(buffer, "utf-8") ?? "";
  if (badRatio(utf8) <= 0.0005) {
    return { text: utf8.replace(/^\uFEFF/, ""), encoding: "UTF-8" };
  }
  const win = decodeWith(buffer, "windows-1256");
  if (win && badRatio(win) < badRatio(utf8)) return { text: win, encoding: "Windows-1256" };
  const utf16 = decodeWith(buffer, "utf-16le");
  if (utf16 && badRatio(utf16) < badRatio(utf8)) return { text: utf16, encoding: "UTF-16LE" };
  return { text: utf8.replace(/^\uFEFF/, ""), encoding: "UTF-8" };
}

/* ============ الفاصل وصفوف العناوين (A2) ============ */

const DELIMS = [",", ";", "\t"] as const;

function splitLine(line: string, delim: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === delim && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function detectDelimiter(text: string): string {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, 20);
  if (lines.length === 0) return ",";
  let best = ",";
  let bestScore = -1;
  for (const d of DELIMS) {
    const counts = lines.map((l) => splitLine(l, d).length);
    const modal = counts.sort((a, b) => b - a)[Math.floor(counts.length / 2)] ?? 1;
    if (modal < 2) continue;
    const consistent = counts.filter((c) => c === modal).length / counts.length;
    const score = consistent * 10 + modal;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

/** يتخطّى حتى 5 صفوف عنوانية فوق صف الأعمدة. */
export function detectHeaderIndex(text: string, delim: string): number {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "").slice(0, 15);
  if (lines.length === 0) return 0;
  const counts = lines.map((l) => splitLine(l, delim).filter((c) => c.trim() !== "").length);
  const modal = [...counts].sort(
    (a, b) => counts.filter((c) => c === b).length - counts.filter((c) => c === a).length,
  )[0] ?? 1;
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const c = counts[i] ?? 0;
    if (c === 1 || c < Math.max(2, modal - 1)) continue;
    return i;
  }
  return 0;
}

/* ============ التطبيع ============ */

function uniqueHeaders(raw: unknown[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((h, i) => {
    let name = h === null || h === undefined || String(h).trim() === "" ? `عمود ${i + 1}` : String(h).trim();
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count > 0) name = `${name}_${count + 1}`;
    return name;
  });
}

function normalize(records: Record<string, unknown>[], headers: string[]): ParsedSheet {
  const columns = headers.filter((h) => h !== "" && h != null);
  const meta: Record<string, ColumnMeta> = {};
  const rawByColumn: Record<string, unknown[]> = {};

  const rows = records.map((r) => {
    const out: Row = {};
    for (const c of columns) {
      const v = r[c];
      (rawByColumn[c] ??= []).push(v);
      if (v === undefined || v === null || v === "") {
        out[c] = null;
        continue;
      }
      if (typeof v === "number" || typeof v === "boolean") {
        out[c] = v;
        continue;
      }
      const parsed = parseNumericValue(v);
      if (parsed) {
        out[c] = parsed.value;
        const m = (meta[c] ??= {});
        if (parsed.unit && !m.unit) m.unit = parsed.unit;
        if (parsed.isPercent) m.isPercent = true;
      } else {
        out[c] = toLatinDigits(String(v)).trim();
      }
    }
    return out;
  });

  for (const c of columns) {
    if (isAmbiguousDateColumn((rawByColumn[c] ?? []).slice(0, 200))) {
      (meta[c] ??= {}).ambiguousDate = true;
    }
  }

  return { columns, rows, columnMeta: meta };
}

/* ============ CSV ============ */

async function parseCsv(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const { text, encoding } = decodeBuffer(buffer);
  if (text.trim() === "") throw new Error("الملف لا يحتوي على أي بيانات. الرجاء التأكد من حفظ الملف قبل رفعه.");

  const delimiter = detectDelimiter(text);
  const headerIndex = detectHeaderIndex(text, delimiter);
  const body =
    headerIndex > 0
      ? text.split(/\r?\n/).filter((l) => l.trim() !== "").slice(headerIndex).join("\n")
      : text;

  const res = Papa.parse<Record<string, unknown>>(body, {
    header: true,
    delimiter,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    transformHeader: (h, i) => (String(h).trim() === "" ? `عمود ${i + 1}` : String(h).trim()),
  });

  const headers = uniqueHeaders(res.meta.fields ?? []);
  if (headers.length === 0) {
    throw new Error("تعذّر التعرّف على أعمدة الملف. تأكد أن الصف الأول يحتوي على أسماء الأعمدة.");
  }
  if (res.data.length === 0) {
    throw new Error("الملف يحتوي على أسماء أعمدة فقط دون صفوف بيانات. أضف صفوفاً ثم أعد الرفع.");
  }

  const warnings: string[] = [];
  const sheet = normalize(res.data, headers);
  for (const [col, m] of Object.entries(sheet.columnMeta ?? {})) {
    if (m.ambiguousDate) warnings.push(`تنسيق تاريخ غامض في العمود «${col}»`);
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    sheetNames: ["البيانات"],
    sheets: { ["البيانات"]: sheet },
    meta: { encoding, delimiter, skippedTitleRows: headerIndex, warnings },
  };
}

/* ============ XLSX ============ */

async function parseXlsx(file: File): Promise<ParsedFile> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  let wb: import("xlsx").WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "array" });
  } catch {
    throw new Error(
      "تعذّر فتح ملف Excel — قد يكون محمياً بكلمة مرور أو بصيغة قديمة (.xls). أعد حفظه بصيغة .xlsx ثم حاول مجدداً.",
    );
  }
  const sheets: Record<string, ParsedSheet> = {};
  const warnings: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) {
      sheets[name] = { columns: [], rows: [] };
      continue;
    }
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, blankrows: false });
    const nonEmpty = matrix.filter((line) => (line as unknown[]).some((c) => c !== null && String(c).trim() !== ""));
    if (nonEmpty.length === 0) {
      sheets[name] = { columns: [], rows: [] };
      continue;
    }
    // تخطّي حتى 5 صفوف عنوانية
    const width = Math.max(...nonEmpty.slice(0, 10).map((l) => (l as unknown[]).filter((c) => c !== null && String(c).trim() !== "").length));
    let start = 0;
    while (start < Math.min(5, nonEmpty.length - 1)) {
      const filled = (nonEmpty[start] as unknown[]).filter((c) => c !== null && String(c).trim() !== "").length;
      if (filled === 1 || filled < Math.max(2, width - 1)) start++;
      else break;
    }
    const headers = uniqueHeaders(nonEmpty[start] as unknown[]);
    const records = nonEmpty.slice(start + 1).map((line) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => (obj[h] = (line as unknown[])[i] ?? null));
      return obj;
    });
    sheets[name] = normalize(records, headers);
    for (const [col, m] of Object.entries(sheets[name].columnMeta ?? {})) {
      if (m.ambiguousDate) warnings.push(`تنسيق تاريخ غامض في العمود «${col}» (${name})`);
    }
  }
  return {
    fileName: file.name,
    fileSize: file.size,
    sheetNames: wb.SheetNames,
    sheets,
    meta: { encoding: "XLSX", warnings },
  };
}

export async function parseFile(file: File): Promise<ParsedFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext === "csv" ? parseCsv(file) : parseXlsx(file);
}
