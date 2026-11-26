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
 * Finalize an order-independent snapshot identity. DuckDB serializes each row
 * as type-aware JSON (including NULL as JSON null); finite numbers, dates and
 * timestamps use DuckDB's JSON representation. Row JSON is sorted and grouped
 * before chunking, retaining duplicate multiplicity. Column order, names, SQL
 * types and exact row count remain part of the identity.
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
