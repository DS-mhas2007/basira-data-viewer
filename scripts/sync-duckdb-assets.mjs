// يستخرج محرك DuckDB-WASM إلى public/duckdb كي يُخدَّم من نفس أصل المنصة (بلا CDN).
// يُقسَّم الـ wasm إلى أجزاء ≤ 12MB لأن منصات الاستضافة تحدّ حجم الملف الثابت (~25MB).
// التشغيل: node scripts/sync-duckdb-assets.mjs   (بعد أي ترقية لـ @duckdb/duckdb-wasm)
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const dist = "node_modules/@duckdb/duckdb-wasm/dist";
const out = "public/duckdb";
const PART = 12 * 1024 * 1024;
const version = JSON.parse(readFileSync("node_modules/@duckdb/duckdb-wasm/package.json", "utf8")).version;

mkdirSync(out, { recursive: true });
for (const f of readdirSync(out)) rmSync(`${out}/${f}`);

const wasm = readFileSync(`${dist}/duckdb-eh.wasm`);
const parts = [];
for (let i = 0, off = 0; off < wasm.length; i++, off += PART) {
  const name = `duckdb-eh.wasm.part${i}`;
  writeFileSync(`${out}/${name}`, wasm.subarray(off, off + PART));
  parts.push(name);
}
copyFileSync(`${dist}/duckdb-browser-eh.worker.js`, `${out}/duckdb-browser-eh.worker.js`);
const sha256 = createHash("sha256").update(wasm).digest("hex");
writeFileSync(`${out}/manifest.json`, JSON.stringify({ version, size: wasm.length, sha256, parts }, null, 2));
console.log(`duckdb ${version}: ${parts.length} parts, ${wasm.length} bytes`);
