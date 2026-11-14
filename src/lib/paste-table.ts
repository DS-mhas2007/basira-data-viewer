/**
 * لصق جدول منسوخ من Excel / Google Sheets / جدول ويب (Ctrl+V) وتحويله إلى ملف CSV
 * يمر على نفس مسار الرفع العادي. يعمل محلياً بلا أي إرسال.
 */
import { detectDelimiter } from "@/lib/parse-file";

export const MAX_PASTE_CHARS = 5_000_000;
const MIN_ROWS = 2;

/** هل النص يشبه جدولاً (≥ صفين وعمودين بعدد أعمدة متسق)؟ */
export function looksLikeTable(text: string): boolean {
  if (!text || text.length > MAX_PASTE_CHARS) return false;
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < MIN_ROWS) return false;
  const delimiter = text.includes("\t") ? "\t" : detectDelimiter(text);
  const sample = lines.slice(0, 20);
  const counts = sample.map((l) => l.split(delimiter).length);
  const modal = [...counts].sort((a, b) => b - a)[Math.floor(counts.length / 2)] ?? 1;
  if (modal < 2) return false;
  // النص العادي الذي يحوي فاصلة هنا وهناك لا يعدّ جدولاً: نشترط اتساق عدد الأعمدة
  return counts.filter((c) => c === modal).length / counts.length >= 0.8;
}

/** يحوّل النص الملصوق إلى ملف، أو null إن لم يكن جدولاً. */
export function pastedTableToFile(text: string, name = "جدول ملصوق.csv"): File | null {
  if (!looksLikeTable(text)) return null;
  return new File(["﻿" + text.trim()], name, { type: "text/csv" });
}

/** هل الحدث موجّه لحقل كتابة؟ (لا نعترض اللصق العادي في الحقول). */
export function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  return el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);
}
