/**
 * فحص آلي: هل الأرقام المذكورة في شرح الوكيل ظهرت فعلاً في نتائج الأدوات؟
 *  - الأعداد الصحيحة الصغيرة (< 10) تُتجاهل (ترقيم/عدّ)، لكن الكسور (4.7) والنِّسب (5%) تُفحص.
 *  - السنوات تُتجاهل فقط حين يدل السياق على سنة (عام 2024، 2024-05، FY2024...) لا حين تكون كمية.
 *  - يقبل التقريب (28684.4 تطابق 28684.399999)، وأوزان الكلمات: "28.7 ألف" و"1.2 مليون".
 *  - النسبة المئوية تُقبل إن ظهرت في المصدر كنسبة (23.5) أو كسر (0.235).
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

const SCALES: [RegExp, number][] = [
  [/^\s*(?:مليار|مليارات|billion|bn)(?![\w\u0600-\u06FF])/i, 1e9],
  [/^\s*(?:مليون|ملايين|million)(?![\w\u0600-\u06FF])/i, 1e6],
  [/^\s*(?:ألف|الاف|آلاف|ألاف|thousand)(?![\w\u0600-\u06FF])/i, 1e3],
];

const YEAR_WORD = /(?:عام|سنة|لعام|للعام|بعام|منذ|حتى|بين|year|since|until|fy|q[1-4])\s*[-:]?\s*$/i;
const YEAR_PREP = /(?:في|من|إلى|الى|بحلول|in|from|to|by)\s*$/i;
const COUNT_NOUN = /^\s*(?:طلب|طلبية|طلبات|صف|صفوف|سجل|سجلات|عميل|عملاء|وحدة|وحدات|منتج|منتجات|مرة|مرات|حالة|حالات|مستخدم|مستخدمين|عنصر|عناصر|orders?|rows?|records?|customers?|units?|items?|users?|times)/i;

function isYearContext(text: string, start: number, end: number): boolean {
  const before = text.slice(Math.max(0, start - 10), start);
  const after = text.slice(end, end + 14);
  if (/^[-/]\d{1,2}/.test(after)) return true; // 2024-05 / 2024/05
  if (/\d[-/]\s*$/.test(before)) return true; // 05-2024
  if (YEAR_WORD.test(before)) return true;
  if (YEAR_PREP.test(before) && !COUNT_NOUN.test(after)) return true;
  return false;
}

/** الأرقام المذكورة في النص والتي لا يدعمها أي رقم في المصادر المسموحة. */
export function findUnsupportedNumbers(answer: string, sources: string[]): string[] {
  const allowed = sources.flatMap((s) => extractNumbers(s));
  const cleaned = normalizeDigits(answer).replace(/(\d),(?=\d{3}\b)/g, "$1");
  const unsupported: string[] = [];
  for (const match of cleaned.matchAll(/\d+(?:\.\d+)?/g)) {
    const raw = match[0];
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    const start = match.index ?? 0;
    const end = start + raw.length;
    const isInteger = !raw.includes(".");
    const after = cleaned.slice(end, end + 14);
    const isPercent = /^\s*(?:%|٪|بالمئة|في المئة|percent)/i.test(after);

    const hasScale = SCALES.some(([re]) => re.test(after));
    if (isInteger && value < 10 && !isPercent && !hasScale) continue;
    if (isInteger && value >= 1900 && value <= 2100 && isYearContext(cleaned, start, end)) continue;

    const scale = SCALES.find(([re]) => re.test(after))?.[1] ?? 1;
    const target = value * scale;
    const tolerance = (0.5 * 10 ** -decimalsOf(raw) + 1e-9) * scale;
    const supported = allowed.some(
      (n) =>
        Math.abs(n - target) <= tolerance ||
        // نسبة مئوية مكتوبة في المصدر ككسر (0.235 ← 23.5%)
        (isPercent && Math.abs(n * 100 - target) <= tolerance),
    );
    if (!supported) unsupported.push(raw);
  }
  return [...new Set(unsupported)];
}
