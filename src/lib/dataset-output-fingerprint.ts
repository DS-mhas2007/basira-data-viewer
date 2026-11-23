export const DATASET_OUTPUT_FINGERPRINT_PREFIX = "output-v1:sha256:";

export interface OutputFingerprintColumn {
  name: string;
  type: string;
}

/** Hash one bounded page of sorted, canonical DuckDB row JSON plus exact multiplicities. */
export async function hashOutputFingerprintChunk(rows: Array<[rowJson: string, frequency: string]>): Promise<string> {
  const payload = JSON.stringify(rows);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Finalize an order-independent snapshot identity. Row JSON is sorted and grouped
 * by DuckDB before chunking; multiplicities preserve duplicate rows exactly.
 * Column order and SQL types remain part of the identity.
 */
export async function finalizeDatasetOutputFingerprint(
  schema: OutputFingerprintColumn[],
  totalRows: string,
  chunkDigests: string[],
): Promise<string> {
  if (!schema.length || !/^(0|[1-9]\d*)$/.test(totalRows)) {
    throw new Error("A complete output schema and exact row count are required.");
  }
  if (chunkDigests.some((digest) => !/^[0-9a-f]{64}$/.test(digest))) {
    throw new Error("Invalid output chunk digest.");
  }
  const manifest = JSON.stringify([
    "dataset-output-v1",
    schema.map((column) => [column.name, column.type.trim().replace(/\s+/g, " ").toUpperCase()]),
    totalRows,
    chunkDigests,
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(manifest));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return DATASET_OUTPUT_FINGERPRINT_PREFIX + hex;
}


export const QUERY_SQL_FINGERPRINT_PREFIX = "query-sql-v1:sha256:";
export const QUERY_OUTPUT_FINGERPRINT_PREFIX = "query-output-v1:sha256:";

/** Hash the exact sanitized SQL text so an output snapshot is bound to the query that produced it. */
export async function fingerprintQuerySql(sql: string): Promise<string> {
  if (!sql.trim()) throw new Error("A non-empty SQL query is required.");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sql.trim()));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return QUERY_SQL_FINGERPRINT_PREFIX + hex;
}

/**
 * Finalize a complete query-result snapshot. Unlike the active-relation fingerprint,
 * this identity also binds the exact SQL text that produced the result.
 */
export async function finalizeQueryOutputFingerprint(
  schema: OutputFingerprintColumn[],
  totalRows: string,
  chunkDigests: string[],
  queryFingerprint: string,
): Promise<string> {
  if (!schema.length || !/^(0|[1-9]\\d*)$/.test(totalRows)) {
    throw new Error("A complete query output schema and exact row count are required.");
  }
  if (!/^query-sql-v1:sha256:[0-9a-f]{64}$/.test(queryFingerprint)) {
    throw new Error("A valid query SQL fingerprint is required.");
  }
  if (chunkDigests.some((digest) => !/^[0-9a-f]{64}$/.test(digest))) {
    throw new Error("Invalid query output chunk digest.");
  }
  const manifest = JSON.stringify([
    "query-output-v1",
    queryFingerprint,
    schema.map((column) => [column.name, column.type.trim().replace(/\\s+/g, " ").toUpperCase()]),
    totalRows,
    chunkDigests,
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(manifest));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return QUERY_OUTPUT_FINGERPRINT_PREFIX + hex;
}
