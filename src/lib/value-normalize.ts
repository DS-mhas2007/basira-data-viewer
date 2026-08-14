/** تطبيع القيم: أرقام عربية، فواصل آلاف، عملات، نِسب، وتواريخ غامضة. */

const ARABIC_INDIC = /[\u0660-\u0669]/g;
const EXTENDED_INDIC = /[\u06F0-\u06F9]/g;

/** يحوّل الأرقام العربية (٠-٩) والفارسية (۰-۹) إلى أرقام لاتينية. */
export function toLatinDigits(input: string): string {
  return input
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EXTENDED_INDIC, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\u066B/g, ".")
    .replace(/\u066C/g, ",");
}

export interface NumericParse {
  value: number;
  /** رمز العملة أو الوحدة إن وُجد، مثل "ر.س" أو "$". */
  unit?: string;
  isPercent?: boolean;
}

const CURRENCY = /(ر\.?\s?س|ر\.?\s?ي|د\.?\s?إ|ج\.?\s?م|ش\.?\s?ج|\$|€|£|USD|SAR|AED|EGP|ILS)/i;

/** يحاول قراءة قيمة نصية كرقم مع الوحدة/النسبة. يُعيد null إن لم تكن رقماً. */
export function parseNumericValue(raw: unknown): NumericParse | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return { value: raw };
  if (typeof raw !== "string") return null;
  let s = toLatinDigits(raw).trim();
  if (s === "") return null;

  const isPercent = /%|٪/.test(s);
  const unitMatch = s.match(CURRENCY);
  const unit = unitMatch ? unitMatch[0].replace(/\s+/g, "") : undefined;

  s = s
    .replace(/[%٪]/g, "")
    .replace(CURRENCY, "")
    .replace(/[\u200f\u200e\u00a0\s]/g, "")
    .replace(/[,\u066C\u2019']/g, "");

  if (!/^[-+(]?\d*\.?\d+\)?$/.test(s)) return null;
  const negative = /^\(.*\)$/.test(s);
  const num = Number(s.replace(/[()]/g, ""));
  if (!Number.isFinite(num)) return null;
  return { value: negative ? -num : num, ...(unit ? { unit } : {}), ...(isPercent ? { isPercent: true } : {}) };
}

const DATE_LIKE = /^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/;

/**
 * يفحص عمود تواريخ: هل الصيغة غامضة (dd/mm مقابل mm/dd كلاهما ممكن)؟
 * لا نخمّن أبداً — نرفع علماً فقط.
 */
export function isAmbiguousDateColumn(values: unknown[]): boolean {
  let dateLike = 0;
  let firstGT12 = 0;
  let secondGT12 = 0;
  for (const v of values) {
    if (typeof v !== "string") continue;
    const m = toLatinDigits(v).trim().match(DATE_LIKE);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (String(m[1]).length === 4) continue; // ISO — غير غامض
    dateLike++;
    if (a > 12) firstGT12++;
    if (b > 12) secondGT12++;
  }
  if (dateLike < 3) return false;
  // إن لم يفصل أي صف بين الترتيبين → غامض
  return firstGT12 === 0 && secondGT12 === 0;
}
