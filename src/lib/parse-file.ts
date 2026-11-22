import Papa from "papaparse";
import { computeDatasetContentFingerprint } from "@/lib/dataset-content-fingerprint";
import {
  detectNumberLocale,
  isAmbiguousDateColumn,
  isHijriYear,
  isScientificColumn,
  parseNamedMonthDate,
  parseNumericValue,
  stripInvisible,
  toLatinDigits,
  type NumericOptions,
} from "@/lib/value-normalize";

export type Row = Record<string, string | number | boolean | null>;

export interface ColumnMeta {
  /** رمز العملة/الوحدة الغالب في العمود إن وُجد. */
  unit?: string;
  isPercent?: boolean;
  ambiguousDate?: boolean;
  /** تواريخ هجرية: تُترك نصاً كما وردت (لا تحويل صامت إلى ميلادي). */
  hijriDate?: boolean;
  /** الفاصلة عُدّت فاصلاً عشرياً (3,5 → 3.5) بعد فحص العمود كله. */
  decimalComma?: boolean;
  /** العمود يخلط صيغتي الأرقام (3,5 و1,234.5)؛ تُرك كما هو دون تخمين. */
  mixedNumberFormat?: boolean;
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
  /** SHA-256 identity for each complete normalized sheet, computed locally during parsing. */
  contentFingerprints?: Record<string, string>;
  fileName: string;
  fileSize: number;
  sheetNames: string[];
  sheets: Record<string, ParsedSheet>;
  meta?: ParseMeta;
}

export const MAX_FILE_SIZE = 25 * 1024 * 1024;

export const MSG_TOO_LARGE =
  "حجم الملف يتجاوز حدّ النسخة الحالية (25MB). نعالج بياناتك داخل جهازك لحماية خصوصيتها، وهذا الحد يضمن بقاء التحليل سريعاً.";
/**
 * ملفات XLSX تُفكّ في ذاكرة المتصفح وتستهلك أضعاف حجمها (قياس: 21MB ≈ 500 ألف صف ≈ 1.4GB
 * وتجمّد 19 ثانية)، بينما CSV بحجم 24MB يُعالج في ثوانٍ. لذلك حدّ XLSX أقل.
 */
export const MAX_XLSX_SIZE = 10 * 1024 * 1024;
export const MSG_XLSX_TOO_LARGE =
  "ملف Excel هذا كبير (أكثر من 10MB) وسيستهلك ذاكرة المتصفح بشكل كبير. احفظه من Excel بصيغة CSV UTF-8 (يدعم حتى 25MB) ثم ارفعه، فهو أسرع بكثير.";
export const MSG_ENCODING =
  "تعذّرت قراءة النص كـUTF-8. إن كان الملف محفوظاً من Excel على ويندوز، أعد حفظه بصيغة CSV UTF-8 أو اختر «محاولة القراءة بترميز ويندوز العربي».";

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    const error = new Error("تم إلغاء قراءة الملف لأن اختياراً أحدث بدأ التنفيذ.");
    error.name = "AbortError";
    throw error;
  }
}

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
  if (ext === "xlsx" && file.size > MAX_XLSX_SIZE) return MSG_XLSX_TOO_LARGE;
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

/** الترميزات التي يمكن فرضها يدوياً (غير "auto"). */
export type ForcedEncoding = "utf-8" | "windows-1256";

function nonAsciiBadRatio(text: string): number {
  let nonAscii = 0;
  let bad = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c > 127) nonAscii++;
    if (c === 0xfffd) bad++;
  }
  return nonAscii === 0 ? 0 : bad / nonAscii;
}

/**
 * يكتشف الترميز: UTF-16 (حسب BOM) → UTF-8 → Windows-1256.
 * الاختبار صارم: UTF-8 يُقبل فقط إن كان النص صالحاً بالكامل، أو تالفاً بنسبة ضئيلة من *الحروف غير اللاتينية*.
 * (النسبة السابقة كانت من طول الملف كله، فملف cp1256 كبير معظمه ASCII كان يُقرأ خطأً كـUTF-8.)
 * يمكن فرض ترميز يدوياً ليتحكم المستخدم عند الخطأ.
 */
export function decodeBuffer(buffer: ArrayBuffer, forced?: ForcedEncoding | "auto"): DecodedText {
  if (forced && forced !== "auto") {
    const text = decodeWith(buffer, forced) ?? "";
    return {
      text: text.replace(/^\uFEFF/, ""),
      encoding: forced === "windows-1256" ? "Windows-1256" : "UTF-8",
    };
  }
  const head = new Uint8Array(buffer.slice(0, 4));
  if (head[0] === 0xff && head[1] === 0xfe) {
    return { text: decodeWith(buffer, "utf-16le") ?? "", encoding: "UTF-16LE" };
  }
  if (head[0] === 0xfe && head[1] === 0xff) {
    return { text: decodeWith(buffer, "utf-16be") ?? "", encoding: "UTF-16BE" };
  }
  let strictUtf8: string | null = null;
  try {
    strictUtf8 = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    strictUtf8 = null;
  }
  if (strictUtf8 !== null) return { text: strictUtf8.replace(/^\uFEFF/, ""), encoding: "UTF-8" };

  const utf8 = decodeWith(buffer, "utf-8") ?? "";
  if (nonAsciiBadRatio(utf8) <= 0.02) {
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
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .slice(0, 20);
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
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .slice(0, 15);
  if (lines.length === 0) return 0;
  const counts = lines.map((l) => splitLine(l, delim).filter((c) => c.trim() !== "").length);
  const modal =
    [...counts].sort(
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
    const clean = h === null || h === undefined ? "" : stripInvisible(String(h)).trim();
    let name = clean === "" ? `عمود ${i + 1}` : clean;
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count > 0) name = `${name}_${count + 1}`;
    return name;
  });
}

function metaWarnings(col: string, m: ColumnMeta, sheet?: string): string[] {
  const where = sheet ? ` (${sheet})` : "";
  const out: string[] = [];
  if (m.ambiguousDate) out.push(`تنسيق تاريخ غامض في العمود «${col}»${where}`);
  if (m.hijriDate)
    out.push(`العمود «${col}»${where} يحوي تواريخ هجرية: تُرك نصاً ولم يُحوَّل إلى ميلادي`);
  if (m.decimalComma)
    out.push(`العمود «${col}»${where}: عُدّت الفاصلة فاصلاً عشرياً (3,5 ← 3.5)`);
  if (m.mixedNumberFormat)
    out.push(`العمود «${col}»${where} يخلط صيغتي الأرقام؛ تُرك كما هو دون تخمين`);
  return out;
}

function normalize(records: Record<string, unknown>[], headers: string[]): ParsedSheet {
  const columns = headers.filter((h) => h !== "" && h != null);
  const meta: Record<string, ColumnMeta> = {};
  const rawByColumn: Record<string, unknown[]> = {};
  const dateColumns = new Map<string, "iso" | "mdy" | "dmy" | "ymd" | "named" | "ambiguous">();
  const hijriColumns = new Set<string>();
  const numberOpts = new Map<string, NumericOptions>();

  // Infer one date convention from the entire column, never from the small AI preview.
  for (const column of columns) {
    const values = records
      .map((record) => record[column])
      .filter((value) => value !== null && value !== undefined && String(value).trim() !== "");
    const strings = values
      .filter((value): value is string => typeof value === "string")
      .map((value) => stripInvisible(toLatinDigits(value)).trim());
    if (strings.length === 0) continue;

    // أسماء الشهور (12 مايو 2024 / May 12, 2024): الاسم يحسم الترتيب فلا غموض.
    const namedCount = strings.filter((value) => parseNamedMonthDate(value) !== null).length;
    if (namedCount > 0 && namedCount / strings.length >= 0.8) {
      dateColumns.set(column, "named");
      continue;
    }

    // التاريخ الهجري: لا نحوّله بصمت إلى ميلادي ولا نعامله كتاريخ DuckDB.
    const yearOf = (value: string) => {
      const m = value.match(/^(\d{4})[/.-]\d{1,2}[/.-]\d{1,2}(?:[ T].*)?$/) ??
        value.match(/^\d{1,2}[/.-]\d{1,2}[/.-](\d{4})(?:[ T].*)?$/);
      return m ? Number(m[1]) : null;
    };
    const years = strings.map(yearOf).filter((y): y is number => y !== null);
    if (years.length >= 1 && years.length / strings.length >= 0.8 && years.every(isHijriYear)) {
      hijriColumns.add(column);
      (meta[column] ??= {}).hijriDate = true;
      continue;
    }

    // الأرقام: الفاصلة عشرية أم آلاف؟ يُقرَّر من العمود كله، والصيغة العلمية فقط حين يكون العمود رقمياً بالكامل.
    {
      const looksNumeric = strings.some((value) => /\d/.test(value));
      if (looksNumeric) {
        const locale = detectNumberLocale(strings);
        if (locale === "eu") {
          const parsed = strings.map((value) => parseNumericValue(value, { locale: "eu" }));
          if (parsed.every((p) => p !== null)) {
            numberOpts.set(column, { locale: "eu" });
            (meta[column] ??= {}).decimalComma = true;
          }
        } else if (locale === "conflict") {
          (meta[column] ??= {}).mixedNumberFormat = true;
        }
        if (!numberOpts.has(column) && isScientificColumn(strings)) {
          numberOpts.set(column, { scientific: true });
        }
      }
    }
    const dateHeader = /date|time|تاريخ|وقت/i.test(column);
    const isoCount = strings.filter((value) =>
      /^\d{4}-\d{1,2}-\d{1,2}(?:[ T].*)?$/.test(value),
    ).length;
    const slashCount = strings.filter((value) =>
      /^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{4}(?:[ T].*)?$/.test(value),
    ).length;
    const ymdCount = strings.filter((value) =>
      /^\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}(?:[ T].*)?$/.test(value),
    ).length;
    const dateRatio = (isoCount + slashCount + ymdCount) / strings.length;
    if (!dateHeader && (strings.length < 3 || dateRatio < 0.8)) continue;
    let firstOver12 = 0;
    let secondOver12 = 0;
    for (const value of strings) {
      const match = value.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-]\d{4}(?:[ T].*)?$/);
      if (!match) continue;
      if (Number(match[1]) > 12) firstOver12++;
      if (Number(match[2]) > 12) secondOver12++;
    }
    const format =
      ymdCount > 0 && slashCount === 0 && isoCount === 0
        ? "ymd"
        : firstOver12 > 0 && secondOver12 === 0
          ? "dmy"
          : secondOver12 > 0 && firstOver12 === 0
            ? "mdy"
            : firstOver12 === 0 && secondOver12 === 0 && slashCount > 0
              ? "ambiguous"
              : isoCount > 0 && slashCount === 0
                ? "iso"
                : "ambiguous";
    dateColumns.set(column, format);
    if (format === "ambiguous") (meta[column] ??= {}).ambiguousDate = true;
  }

  const parseDateValue = (
    raw: string,
    format: "iso" | "mdy" | "dmy" | "ymd" | "named" | "ambiguous",
  ): string | null => {
    const value = stripInvisible(toLatinDigits(raw)).trim();
    if (format === "ambiguous") return null;
    if (format === "named") return parseNamedMonthDate(value);
    const match = value.match(
      /^(\d{1,4})[\/.-](\d{1,2})[\/.-](\d{1,4})(?:[ T](\d{1,2}:\d{2}(?::\d{2})?))?$/,
    );
    if (!match) return null;
    const first = Number(match[1]);
    const second = Number(match[2]);
    const third = Number(match[3]);
    const yearFirst = match[1]!.length === 4;
    const year = yearFirst ? first : third;
    const month = yearFirst ? second : format === "mdy" ? first : second;
    const day = yearFirst ? third : format === "mdy" ? second : first;
    if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    )
      return null;
    return (
      String(year) +
      "-" +
      String(month).padStart(2, "0") +
      "-" +
      String(day).padStart(2, "0") +
      (match[4] ? " " + match[4] : "")
    );
  };

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
      if (hijriColumns.has(c)) {
        out[c] = stripInvisible(toLatinDigits(String(v))).trim();
        continue;
      }
      const dateFormat = dateColumns.get(c);
      if (dateFormat) {
        const normalizedDate = parseDateValue(String(v), dateFormat);
        if (normalizedDate) {
          out[c] = normalizedDate;
          continue;
        }
      }
      const parsed = parseNumericValue(v, numberOpts.get(c));
      if (parsed) {
        out[c] = parsed.value;
        const m = (meta[c] ??= {});
        if (parsed.unit && !m.unit) m.unit = parsed.unit;
        if (parsed.isPercent) m.isPercent = true;
      } else {
        out[c] = stripInvisible(toLatinDigits(String(v))).trim();
      }
    }
    return out;
  });

  for (const c of columns) {
    if (!dateColumns.has(c) && isAmbiguousDateColumn((rawByColumn[c] ?? []).slice(0, 200))) {
      (meta[c] ??= {}).ambiguousDate = true;
    }
  }

  return { columns, rows, columnMeta: meta };
}

/* ============ CSV ============ */

async function parseCsv(
  file: File,
  encoding?: ForcedEncoding | "auto",
  signal?: AbortSignal,
): Promise<ParsedFile> {
  throwIfAborted(signal);
  const buffer = await file.arrayBuffer();
  throwIfAborted(signal);
  const { text, encoding: detected } = decodeBuffer(buffer, encoding);
  throwIfAborted(signal);
  if (text.trim() === "")
    throw new Error("الملف لا يحتوي على أي بيانات. الرجاء التأكد من حفظ الملف قبل رفعه.");

  const delimiter = detectDelimiter(text);
  const headerIndex = detectHeaderIndex(text, delimiter);
  const body =
    headerIndex > 0
      ? text
          .split(/\r?\n/)
          .filter((l) => l.trim() !== "")
          .slice(headerIndex)
          .join("\n")
      : text;

  const res = Papa.parse<Record<string, unknown>>(body, {
    header: true,
    delimiter,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    transformHeader: (h, i) => {
      const clean = stripInvisible(String(h)).trim();
      return clean === "" ? `عمود ${i + 1}` : clean;
    },
  });
  throwIfAborted(signal);

  // علامة اقتباس غير مغلقة تبتلع بقية الملف في خلية واحدة، فنرفض الملف بدل أن نعرض بيانات خاطئة.
  const quoteError = res.errors.find((e) => e.type === "Quotes");
  if (quoteError) {
    throw new Error(
      `الملف يحتوي على علامة اقتباس غير مغلقة قرب السطر ${quoteError.row != null ? quoteError.row + 2 : "؟"}. صحّح الملف ثم أعد الرفع.`,
    );
  }
  const mismatchRows = res.errors.filter((e) => e.type === "FieldMismatch").length;

  const headers = uniqueHeaders(res.meta.fields ?? []);
  if (headers.length === 0) {
    throw new Error("تعذّر التعرّف على أعمدة الملف. تأكد أن الصف الأول يحتوي على أسماء الأعمدة.");
  }
  if (res.data.length === 0) {
    throw new Error("الملف يحتوي على أسماء أعمدة فقط دون صفوف بيانات. أضف صفوفاً ثم أعد الرفع.");
  }

  const warnings: string[] = [];
  if (mismatchRows > 0) warnings.push(`${mismatchRows} صف عدد حقوله لا يطابق عدد الأعمدة`);
  const sheet = normalize(res.data, headers);
  for (const [col, m] of Object.entries(sheet.columnMeta ?? {})) {
    warnings.push(...metaWarnings(col, m));
  }

  return {
    fileName: file.name,
    fileSize: file.size,
    sheetNames: ["البيانات"],
    sheets: { ["البيانات"]: sheet },
    contentFingerprints: { ["البيانات"]: await computeDatasetContentFingerprint(sheet.columns, sheet.rows) },
    meta: { encoding: detected, delimiter, skippedTitleRows: headerIndex, warnings },
  };
}

/* ============ XLSX ============ */

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * خلايا Excel التاريخية مخزّنة كأرقام تسلسلية (45306.5). نحوّلها لنص ISO حتى لا تظهر كأرقام.
 * نستخدم رمز تنسيق الخلية (cellNF) بدل Date لتجنب مشاكل المنطقة الزمنية.
 */
function convertDateCells(XLSX: typeof import("xlsx"), ws: import("xlsx").WorkSheet) {
  for (const key of Object.keys(ws)) {
    if (key.startsWith("!")) continue;
    const cell = ws[key] as import("xlsx").CellObject | undefined;
    if (!cell || cell.t !== "n" || typeof cell.v !== "number" || !cell.z) continue;
    if (!XLSX.SSF.is_date(String(cell.z))) continue;
    const d = XLSX.SSF.parse_date_code(cell.v);
    if (!d) continue;
    const hasTime = d.H !== 0 || d.M !== 0 || Math.floor(d.S) !== 0;
    const time = `${pad2(d.H)}:${pad2(d.M)}:${pad2(Math.floor(d.S))}`;
    const iso = cell.v < 1 ? time : `${d.y}-${pad2(d.m)}-${pad2(d.d)}${hasTime ? ` ${time}` : ""}`;
    cell.t = "s";
    cell.v = iso;
    delete cell.w;
  }
}

async function parseXlsx(file: File, signal?: AbortSignal): Promise<ParsedFile> {
  throwIfAborted(signal);
  const XLSX = await import("xlsx");
  throwIfAborted(signal);
  const buffer = await file.arrayBuffer();
  throwIfAborted(signal);
  let wb: import("xlsx").WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "array", cellNF: true });
  } catch {
    throw new Error(
      "تعذّر فتح ملف Excel — قد يكون محمياً بكلمة مرور أو بصيغة قديمة (.xls). أعد حفظه بصيغة .xlsx ثم حاول مجدداً.",
    );
  }
  throwIfAborted(signal);
  const sheets: Record<string, ParsedSheet> = {};
  const warnings: string[] = [];
  // الأوراق المخفية (Hidden / VeryHidden) لا تُعرض كأوراق عادية؛ إن كانت كلها مخفية نعرضها بدل رفض الملف.
  const hiddenFlags = wb.Workbook?.Sheets ?? [];
  const visibleNames = wb.SheetNames.filter((_, i) => !hiddenFlags[i]?.Hidden);
  const sheetNames = visibleNames.length > 0 ? visibleNames : wb.SheetNames;
  const skippedHidden = wb.SheetNames.filter((n) => !sheetNames.includes(n));
  if (skippedHidden.length > 0)
    warnings.push(`تم تجاهل ${skippedHidden.length} ورقة مخفية: ${skippedHidden.join("، ")}`);
  for (const name of sheetNames) {
    throwIfAborted(signal);
    const ws = wb.Sheets[name];
    if (!ws) {
      sheets[name] = { columns: [], rows: [] };
      continue;
    }
    convertDateCells(XLSX, ws);
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: null,
      blankrows: true,
    });
    // نحتفظ برقم الصف الفعلي في الورقة لنطابق الخلايا المدمجة (!merges) بعد حذف الصفوف الفارغة.
    const range = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]) : { s: { r: 0, c: 0 } };
    const absRows: number[] = [];
    const nonEmpty = matrix.filter((line, i) => {
      const keep = (line as unknown[]).some((c) => c !== null && String(c).trim() !== "");
      if (keep) absRows.push(range.s.r + i);
      return keep;
    });
    if (nonEmpty.length === 0) {
      sheets[name] = { columns: [], rows: [] };
      continue;
    }
    // تخطّي حتى 5 صفوف عنوانية
    const width = Math.max(
      ...nonEmpty
        .slice(0, 10)
        .map((l) => (l as unknown[]).filter((c) => c !== null && String(c).trim() !== "").length),
    );
    let start = 0;
    while (start < Math.min(5, nonEmpty.length - 1)) {
      const filled = (nonEmpty[start] as unknown[]).filter(
        (c) => c !== null && String(c).trim() !== "",
      ).length;
      if (filled === 1 || filled < Math.max(2, width - 1)) start++;
      else break;
    }
    // عنوان من صفّين: خلية عنوان مدمجة أفقياً (B1:C1) وتحتها عناوين فرعية → "الدرجات - منتصف".
    let headerCells = nonEmpty[start] as unknown[];
    let dataStart = start + 1;
    const next = nonEmpty[start + 1] as unknown[] | undefined;
    const merges = (ws["!merges"] ?? []).filter(
      (m) => m.s.r === absRows[start] && m.e.c > m.s.c && m.s.r === m.e.r,
    );
    if (next && merges.length > 0 && absRows[start + 1] === absRows[start]! + 1) {
      const isLabel = (c: unknown) => typeof c === "string" && c.trim() !== "" && !/^[\d\s.,%-]+$/.test(c);
      const subFilled = next.filter((c) => c !== null && String(c).trim() !== "");
      if (subFilled.length > 0 && subFilled.every(isLabel)) {
        const top = [...headerCells];
        for (const m of merges) {
          const label = top[m.s.c - range.s.c];
          for (let c = m.s.c; c <= m.e.c; c++) top[c - range.s.c] = label;
        }
        const width = Math.max(top.length, next.length);
        headerCells = Array.from({ length: width }, (_, i) => {
          const t = top[i] != null && String(top[i]).trim() !== "" ? String(top[i]).trim() : "";
          const b = next[i] != null && String(next[i]).trim() !== "" ? String(next[i]).trim() : "";
          return t && b && t !== b ? `${t} - ${b}` : b || t || null;
        });
        dataStart = start + 2;
        warnings.push(`دُمج صفّا العناوين في الورقة (${name}) في صف عناوين واحد`);
      }
    }
    const headers = uniqueHeaders(headerCells);
    const records = nonEmpty.slice(dataStart).map((line) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => (obj[h] = (line as unknown[])[i] ?? null));
      return obj;
    });
    sheets[name] = normalize(records, headers);
    for (const [col, m] of Object.entries(sheets[name].columnMeta ?? {})) {
      warnings.push(...metaWarnings(col, m, name));
    }
  }
  return {
    fileName: file.name,
    fileSize: file.size,
    sheetNames,
    sheets,
    contentFingerprints: Object.fromEntries(await Promise.all(
      Object.entries(sheets).map(async ([name, sheet]) => [name, await computeDatasetContentFingerprint(sheet.columns, sheet.rows)] as const),
    )),
    meta: { encoding: "XLSX", warnings },
  };
}

export async function parseFile(
  file: File,
  options: { encoding?: ForcedEncoding | "auto"; signal?: AbortSignal } = {},
): Promise<ParsedFile> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  throwIfAborted(options.signal);
  return ext === "csv"
    ? parseCsv(file, options.encoding, options.signal)
    : parseXlsx(file, options.signal);
}
