/**
 * ختم المصداقية الرقمي (Verified Local Audit Seal).
 * يحسب بصمة SHA-256 محلياً للبيانات المحلّلة — بلا أي اتصال بخادم.
 */
import type { Row } from "@/lib/parse-file";
import { computeDatasetContentFingerprint } from "@/lib/dataset-content-fingerprint";

export interface AuditSeal {
  /** SHA-256 digest of the complete normalized sheet content. */
  hash: string;
  /** أول 16 خانة للعرض. */
  shortHash: string;
  /** Versioned fingerprint shared with the metric registry. */
  contentFingerprint: string;
  /** ISO timestamp بدقة الميلي ثانية. */
  issuedAt: string;
  rowCount: number;
  columnCount: number;
  fileName: string;
}

export async function computeAuditSeal(params: {
  fileName: string;
  columns: string[];
  rows: Row[];
  rowCount?: number;
}): Promise<AuditSeal> {
  const contentFingerprint = await computeDatasetContentFingerprint(params.columns, params.rows);
  const hash = contentFingerprint.slice("content-v1:sha256:".length);
  return {
    hash,
    shortHash: hash.slice(0, 16),
    contentFingerprint,
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
