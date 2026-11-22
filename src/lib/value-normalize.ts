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

/** علامات اتجاه/تنسيق خفية تلتصق بالنص عند النسخ من Word/Excel وتكسر مطابقة أسماء الأعمدة والقيم. */
const INVISIBLE = /[\u200b\u200e\u200f\u202a-\u202e\u2066-\u2069\u061c\ufeff]/g;

export function stripInvisible(input: string): string {
  return input.replace(INVISIBLE, "");
}

export interface NumericOptions {
  /** "eu": الفاصلة عشرية والنقطة آلاف (1.234,56). الافتراضي: الفاصلة آلاف والنقطة عشرية. */
  locale?: "eu";
  /** يقبل الصيغة العلمية (1.5e3). تُفعَّل على مستوى العمود فقط حتى لا تُفسَد أكواد مثل 12E3. */
  scientific?: boolean;
}

export interface NumericParse {
  value: number;
  /** رمز العملة أو الوحدة إن وُجد، مثل "ر.س" أو "$". */
  unit?: string;
  isPercent?: boolean;
}

const CURRENCY = /(ر\.?\s?س|ر\.?\s?ي|د\.?\s?إ|ج\.?\s?م|ش\.?\s?ج|\$|€|£|USD|SAR|AED|EGP|ILS)/i;

/** يحاول قراءة قيمة نصية كرقم مع الوحدة/النسبة. يُعيد null إن لم تكن رقماً. */
export function parseNumericValue(raw: unknown, opts: NumericOptions = {}): NumericParse | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return { value: raw };
  if (typeof raw !== "string") return null;
  let s = stripInvisible(toLatinDigits(raw)).trim();
  if (s === "") return null;

  const isPercent = /%|٪/.test(s);
  const unitMatch = s.match(CURRENCY);
  const unit = unitMatch ? unitMatch[0].replace(/\s+/g, "") : undefined;

  s = s
    .replace(/[%٪]/g, "")
    .replace(CURRENCY, "")
    .replace(/[\u200f\u200e\u00a0\s]/g, "")
    .replace(/[\u066C\u2019']/g, ",");

  const negative = /^\(.*\)$/.test(s);
  const inner = negative ? s.slice(1, -1) : s;
  const sign = /^[-+]/.exec(inner)?.[0];
  const body = sign ? inner.slice(1) : inner;

  if (opts.scientific && /^\d+(?:\.\d+)?[eE][+-]?\d+$/.test(body)) {
    if (/^0\d/.test(body)) return null;
    const sci = Number(body);
    if (!Number.isFinite(sci)) return null;
    const value = negative || sign === "-" ? -sci : sci;
    return { value, ...(unit ? { unit } : {}), ...(isPercent ? { isPercent: true } : {}) };
  }

  // الافتراضي: الفاصلة آلاف فقط (1,234 أو 1,234.5). وفي نمط "eu" (يحدَّد على مستوى العمود):
  // النقطة آلاف والفاصلة عشرية (1.234,56 / 3,5). خارج النمطين نتركه نصاً بدل أن نحوّله بصمت إلى 35.
  let canon = body;
  if (opts.locale === "eu") {
    if (!/\d/.test(body) || !/^(?:\d{1,3}(?:\.\d{3})+|\d+)?(?:,\d+)?$/.test(body)) return null;
    canon = body.replace(/\./g, "").replace(",", ".");
  } else if (!/\d/.test(body) || !/^(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?$/.test(body)) {
    return null;
  }

  const digits = canon.replace(/[,.]/g, "");
  // معرّفات وأرقام هواتف: أصفار بادئة ("007" / "0501234567") أو +966… أو أكثر من 15 خانة
  // تفقد معناها أو دقتها إذا حُوّلت إلى رقم، فتبقى نصوصاً.
  if (/^0\d/.test(canon.replace(/,/g, ""))) return null;
  if (sign === "+" && digits.length >= 8) return null;
  if (digits.replace(/^0+/, "").length > 15) return null;

  const num = Number(canon.replace(/,/g, ""));
  if (!Number.isFinite(num)) return null;
  const value = negative || sign === "-" ? -num : num;
  return { value, ...(unit ? { unit } : {}), ...(isPercent ? { isPercent: true } : {}) };
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


/* ============ استنتاج صيغة الأرقام لكل عمود ============ */

export type NumberLocaleResult = "us" | "eu" | "conflict";

/** يستخرج جسم الرقم (دون وحدة/نسبة/إشارة) أو null إن لم يكن شكله رقمياً. */
function numericBody(raw: string): string | null {
  let s = stripInvisible(toLatinDigits(raw)).trim();
  s = s.replace(/[%٪]/g, "").replace(CURRENCY, "").replace(/[\u00a0\s]/g, "").replace(/[\u2019']/g, ",");
  if (/^\(.*\)$/.test(s)) s = s.slice(1, -1);
  s = s.replace(/^[-+]/, "");
  return /^[\d.,]+$/.test(s) && /\d/.test(s) ? s : null;
}

/**
 * يقرّر لكل عمود هل الفاصلة عشرية (eu) أم آلاف (us) من مجموع القيم، لا من قيمة واحدة.
 * "conflict": القيم تخلط الصيغتين، فنتركها كما هي ولا نخمّن.
 */
export function detectNumberLocale(values: string[]): NumberLocaleResult {
  let eu = 0;
  let us = 0;
  for (const v of values) {
    const b = numericBody(v);
    if (!b) continue;
    if (/^\d{1,3}(?:\.\d{3})+,\d+$/.test(b)) eu++;
    else if (/^\d+,(?:\d{1,2}|\d{4,})$/.test(b)) eu++;
    else if (/^0,\d+$/.test(b)) eu++;
    else if (/^\d{1,3}(?:,\d{3}){2,}(?:\.\d+)?$/.test(b)) us++;
    else if (/^\d{1,3},\d{3}\.\d+$/.test(b)) us++;
    else if (/^\d+\.(?:\d{1,2}|\d{4,})$/.test(b)) us++;
  }
  if (eu > 0 && us > 0) return "conflict";
  return eu > 0 ? "eu" : "us";
}

const SCI = /^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/;

/** هل العمود كله أرقام عادية أو علمية، وفيه علمي واحد على الأقل؟ (وإلا نتركه نصاً). */
export function isScientificColumn(values: string[]): boolean {
  let sci = 0;
  for (const raw of values) {
    const v = stripInvisible(toLatinDigits(raw)).trim();
    if (v === "") continue;
    if (SCI.test(v)) sci++;
    else if (!parseNumericValue(v)) return false;
  }
  return sci > 0;
}

/* ============ التواريخ: أسماء الشهور والهجري ============ */

const norm = (t: string) =>
  stripInvisible(t)
    .toLowerCase()
    .replace(/[\u064b-\u0652\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ")
    .trim();

const MONTH_NAMES: Record<number, string[]> = {
  1: ["يناير", "كانون الثاني", "جانفي", "jan", "january"],
  2: ["فبراير", "شباط", "فيفري", "feb", "february"],
  3: ["مارس", "اذار", "mar", "march"],
  4: ["ابريل", "نيسان", "افريل", "apr", "april"],
  5: ["مايو", "ايار", "ماي", "may"],
  6: ["يونيو", "يونيه", "حزيران", "جوان", "jun", "june"],
  7: ["يوليو", "يوليه", "تموز", "جويليه", "jul", "july"],
  8: ["اغسطس", "اب", "اوت", "aug", "august"],
  9: ["سبتمبر", "ايلول", "sep", "sept", "september"],
  10: ["اكتوبر", "تشرين الاول", "oct", "october"],
  11: ["نوفمبر", "تشرين الثاني", "نونبر", "nov", "november"],
  12: ["ديسمبر", "كانون الاول", "دجنبر", "dec", "december"],
};
const MONTH_LOOKUP = new Map<string, number>();
for (const [m, names] of Object.entries(MONTH_NAMES)) for (const n of names) MONTH_LOOKUP.set(norm(n), Number(m));

const TIME = "(?:[ T,]+(\\d{1,2}:\\d{2}(?::\\d{2})?))?";
const DMY_NAMED = new RegExp(`^(\\d{1,2})(?:st|nd|rd|th)?[\\s\\-/.]+([^\\d\\-/.,]+?)[\\s\\-/.,]+(\\d{4})${TIME}$`, "i");
const MDY_NAMED = new RegExp(`^([^\\d\\-/.,]+?)[\\s\\-/.]+(\\d{1,2})(?:st|nd|rd|th)?[\\s,\\-/.]+(\\d{4})${TIME}$`, "i");

/** "12 مايو 2024" / "May 12, 2024" / "12-May-2024" → "2024-05-12". اسم الشهر يفصل الترتيب، فلا غموض. */
export function parseNamedMonthDate(raw: string): string | null {
  const v = stripInvisible(toLatinDigits(raw)).replace(/،/g, ",").trim();
  let day: number, year: number, monthName: string, time: string | undefined;
  let m = v.match(DMY_NAMED);
  if (m) {
    day = Number(m[1]); monthName = m[2]!; year = Number(m[3]); time = m[4];
  } else if ((m = v.match(MDY_NAMED))) {
    monthName = m[1]!; day = Number(m[2]); year = Number(m[3]); time = m[4];
  } else return null;
  const month = MONTH_LOOKUP.get(norm(monthName));
  if (!month || year < 1000 || year > 9999 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${year}-${p2(month)}-${p2(day)}${time ? ` ${time}` : ""}`;
}

/** سنة هجرية معقولة؟ (1300–1500 هـ ≈ 1882–2077 م). السنة الميلادية بين 1300 و1500 شبه معدومة في بيانات فعلية. */
export function isHijriYear(year: number): boolean {
  return year >= 1300 && year <= 1500;
}
