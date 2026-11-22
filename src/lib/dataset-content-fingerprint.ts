import type { Row } from "@/lib/parse-file";

/**
 * SHA-256 identity of the complete normalized sheet content.
 * Column order, row order, cell types, nulls, missing cells and empty strings
 * are represented explicitly. This is a logical parsed-data fingerprint, not
 * a hash of the original CSV/XLSX bytes.
 */
export async function computeDatasetContentFingerprint(
  columns: string[],
  rows: Row[],
): Promise<string> {
  const encodeCell = (value: Row[string] | undefined): unknown => {
    if (value === undefined) return ["missing"];
    if (value === null) return ["null"];
    if (typeof value === "string") return ["string", value];
    if (typeof value === "boolean") return ["boolean", value];
    if (typeof value === "number") return ["number", Object.is(value, -0) ? "-0" : String(value)];
    return ["unsupported", String(value)];
  };
  const canonical = JSON.stringify({
    version: 1,
    columns,
    rows: rows.map((row) => columns.map((column) => encodeCell(row[column]))),
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `content-v1:sha256:${hex}`;
}
