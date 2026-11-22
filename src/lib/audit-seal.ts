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
  /** SHA-256 of the complete normalized sheet values, independent of file name. */
  contentFingerprint: string;
  /** ISO timestamp بدقة الميلي ثانية. */
  issuedAt: string;
  rowCount: number;
  columnCount: number;
  fileName: string;
}

function canonical(columns: string[], rows: Row[]): string {
  // Typed, length-safe JSON avoids delimiter collisions and distinguishes null,
  // missing, empty strings, booleans, numbers, and textual numeric identifiers.
  const encodeCell = (value: Row[string] | undefined): unknown => {
    if (value === undefined) return ["missing"];
    if (value === null) return ["null"];
    if (typeof value === "string") return ["string", value];
    if (typeof value === "boolean") return ["boolean", value];
    if (typeof value === "number") return ["number", Object.is(value, -0) ? "-0" : String(value)];
    return ["unsupported", String(value)];
  };
  return JSON.stringify({
    version: 1,
    columns,
    rows: rows.map((row) => columns.map((column) => encodeCell(row[column]))),
  });
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
  const text = canonical(params.columns, params.rows);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const hash = toHex(digest);
  return {
    hash,
    shortHash: hash.slice(0, 16),
    contentFingerprint: `content-v1:sha256:${hash}`,
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