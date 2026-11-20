/**
 * فحص آلي بسيط: هل الأرقام المذكورة في شرح الوكيل ظهرت فعلاً في نتائج الأدوات؟
 * يتجاهل الأعداد الصغيرة (< 10) والسنوات المعروفة لتقليل الإنذارات الكاذبة،
 * ويقبل التقريب (28684.4 تطابق 28684.399999).
 */
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function normalizeDigits(text: string): string {
  return text
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/٫/g, ".")
    .replace(/[٬،]/g, ",");
}

export function extractNumbers(text: string): number[] {
  const cleaned = normalizeDigits(text).replace(/(\d),(?=\d{3}\b)/g, "$1");
  const out: number[] = [];
  for (const match of cleaned.matchAll(/\d+(?:\.\d+)?/g)) {
    const value = Number(match[0]);
    if (Number.isFinite(value)) out.push(value);
  }
  return out;
}

function decimalsOf(raw: string): number {
  const dot = raw.indexOf(".");
  return dot < 0 ? 0 : raw.length - dot - 1;
}

function isIgnorable(value: number, isInteger: boolean): boolean {
  if (value < 10) return true;
  return isInteger && value >= 1900 && value <= 2100;
}

/** الأرقام المذكورة في النص والتي لا يدعمها أي رقم في المصادر المسموحة. */
export function findUnsupportedNumbers(answer: string, sources: string[]): string[] {
  const allowed = sources.flatMap((s) => extractNumbers(s));
  const cleaned = normalizeDigits(answer).replace(/(\d),(?=\d{3}\b)/g, "$1");
  const unsupported: string[] = [];
  for (const match of cleaned.matchAll(/\d+(?:\.\d+)?/g)) {
    const raw = match[0];
    const value = Number(raw);
    if (!Number.isFinite(value) || isIgnorable(value, !raw.includes("."))) continue;
    const tolerance = 0.5 * 10 ** -decimalsOf(raw) + 1e-9;
    if (!allowed.some((n) => Math.abs(n - value) <= tolerance)) unsupported.push(raw);
  }
  return [...new Set(unsupported)];
}
