/**
 * صياغة سردية اختيارية بالذكاء الاصطناعي لنصوص استنتاجات التقرير — مقيّدة بالأدلة:
 *  - النموذج لا يرى إلا حقائق مستخرجة من نتيجة SQL نفسها (عناوين، أرقام، أعلى الصفوف).
 *  - أي نص فيه رقم غير موجود في الحقائق يُرفض ويبقى النص المحلي الأصلي.
 */
import { findUnsupportedNumbers } from "@/lib/answer-numbers-check";

export interface NarrativeInsightInput {
  id: string;
  title: string;
  /** عدد الصفوف الداخلة وعدد صفوف النتيجة. */
  baseRowCount: number | null;
  resultRowCount: number;
  highlights: { label: string; value: string }[];
  rows: Record<string, unknown>[];
}

export interface NarrativeFacts {
  id: string;
  title: string;
  facts: string[];
}

const MAX_ROWS = 12;

function cell(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 80);
}

/** يبني الحقائق الوحيدة التي يُسمح للنموذج بالاستناد إليها. */
export function buildNarrativeFacts(items: NarrativeInsightInput[]): NarrativeFacts[] {
  return items.slice(0, 12).map((it) => {
    const facts = [
      ...(it.baseRowCount === null ? [] : [`عدد الصفوف الداخلة في التحليل: ${it.baseRowCount}`]),
      `عدد صفوف النتيجة: ${it.resultRowCount}`,
      ...it.highlights.map((h) => `${h.label}: ${h.value}`),
      ...it.rows.slice(0, MAX_ROWS).map((r, i) => `صف ${i + 1}: ${Object.entries(r).map(([k, v]) => `${k}=${cell(v)}`).join("، ")}`),
    ];
    return { id: it.id, title: it.title, facts };
  });
}

export interface NarrationResult {
  accepted: Record<string, string>;
  rejected: string[];
}

/** يتحقق من كل نص: لا أرقام خارج الحقائق، طول معقول، عربي. */
export function validateNarrations(
  narrations: { id: string; text: string }[],
  facts: NarrativeFacts[],
): NarrationResult {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const accepted: Record<string, string> = {};
  const rejected: string[] = [];
  for (const n of narrations) {
    const f = byId.get(n.id);
    const text = n.text.replace(/\s+/g, " ").trim();
    if (!f || text.length < 20 || text.length > 700 || !/[؀-ۿ]/.test(text)) {
      rejected.push(n.id);
      continue;
    }
    const sources = [f.title, ...f.facts];
    if (findUnsupportedNumbers(text, sources).length > 0) {
      rejected.push(n.id);
      continue;
    }
    accepted[n.id] = text;
  }
  return { accepted, rejected };
}
