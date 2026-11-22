import type { Row } from "@/lib/parse-file";

const CHUNK_BYTES = 1024 * 1024;

/**
 * Bounded-memory SHA-256 fingerprint of a complete normalized sheet.
 *
 * Rows are serialized with explicit type tags, then streamed through fixed-size
 * SHA-256 chunks. A final SHA-256 manifest binds the ordered columns, row count,
 * and ordered chunk digests. Memory is bounded by one chunk plus the largest
 * individual row, rather than a full-table JSON string.
 *
 * This identifies logical parsed-sheet content, not original CSV/XLSX bytes.
 */
export async function computeDatasetContentFingerprint(
  columns: string[],
  rows: Row[],
): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = new Uint8Array(CHUNK_BYTES);
  const chunkHashes: string[] = [];
  let used = 0;

  const digestHex = async (bytes: Uint8Array): Promise<string> => {
    // Copy into a standalone ArrayBuffer to satisfy Web Crypto's BufferSource typing
    // and avoid passing a potentially SharedArrayBuffer-backed view.
    const ownedBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(ownedBuffer).set(bytes);
    const digest = await crypto.subtle.digest("SHA-256", ownedBuffer);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  };

  const flush = async () => {
    if (used === 0) return;
    chunkHashes.push(await digestHex(buffer.slice(0, used)));
    used = 0;
  };

  const append = async (bytes: Uint8Array) => {
    let offset = 0;
    while (offset < bytes.length) {
      if (used === CHUNK_BYTES) await flush();
      const take = Math.min(CHUNK_BYTES - used, bytes.length - offset);
      buffer.set(bytes.subarray(offset, offset + take), used);
      used += take;
      offset += take;
    }
  };

  const encodeCell = (value: Row[string] | undefined): unknown => {
    if (value === undefined) return ["missing"];
    if (value === null) return ["null"];
    if (typeof value === "string") return ["string", value];
    if (typeof value === "boolean") return ["boolean", value];
    if (typeof value === "number") return ["number", Object.is(value, -0) ? "-0" : String(value)];
    return ["unsupported", String(value)];
  };

  for (const row of rows) {
    const rowBytes = encoder.encode(JSON.stringify(columns.map((column) => encodeCell(row[column]))));
    await append(rowBytes);
    await append(encoder.encode("\n"));
  }
  await flush();

  const manifest = encoder.encode(JSON.stringify([
    "dataset-content-v1",
    columns,
    rows.length,
    chunkHashes,
  ]));
  return `content-v1:sha256:${await digestHex(manifest)}`;
}
