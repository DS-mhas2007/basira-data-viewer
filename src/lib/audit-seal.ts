/**
 * ختم المصداقية الرقمي (Verified Local Audit Seal).
 * يحسب بصمة SHA-256 محلياً للبيانات المحلّلة — بلا أي اتصال بخادم.
 */
import type { Row } from "@/lib/parse-file";

export interface AuditSeal {
  /** بصمة SHA-256 كاملة (64 خانة hex). */
  hash: string;
  /** أول 16 خانة للعرض. */
  shortHash: string;
  /** ISO timestamp بدقة الميلي ثانية. */
  issuedAt: string;
  rowCount: number;
  columnCount: number;
  fileName: string;
}

function canonical(fileName: string, columns: string[], rows: Row[]): string {
  const head = `${fileName}\u0000${columns.join("\u0001")}\u0000${rows.length}`;
  const body = rows
    .map((r) => columns.map((c) => String(r[c] ?? "")).join("\u0001"))
    .join("\n");
  return `${head}\n${body}`;
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function computeAuditSeal(params: {
  fileName: string;
  columns: string[];
  rows: Row[];
  rowCount?: number;
}): Promise<AuditSeal> {
  const text = canonical(params.fileName, params.columns, params.rows);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const hash = toHex(digest);
  return {
    hash,
    shortHash: hash.slice(0, 16),
    issuedAt: new Date().toISOString(),
    rowCount: params.rowCount ?? params.rows.length,
    columnCount: params.columns.length,
    fileName: params.fileName,
  };
}

export function sealTimestampAr(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const time = d.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${date} — ${time}`;
}