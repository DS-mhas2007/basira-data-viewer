import * as duckdb from "@duckdb/duckdb-wasm";

/**
 * Browser-only DuckDB bootstrap. Keeping the package import in this lazy module
 * prevents its Worker-dependent module initialization from entering SSR.
 */
const INIT_TIMEOUT_MS = 180_000;
const VERSION = "1.33.1-dev57.0";

function unpkgBundles(): duckdb.DuckDBBundles {
  const base = `https://unpkg.com/@duckdb/duckdb-wasm@${VERSION}/dist/`;
  return {
    mvp: {
      mainModule: base + "duckdb-mvp.wasm",
      mainWorker: base + "duckdb-browser-mvp.worker.js",
    },
    eh: { mainModule: base + "duckdb-eh.wasm", mainWorker: base + "duckdb-browser-eh.worker.js" },
  };
}

const LOCAL_BASE = "/duckdb/";

interface LocalManifest {
  version: string;
  size: number;
  sha256: string;
  parts: string[];
}

async function fetchRetry(url: string, tries = 4): Promise<ArrayBuffer> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) throw new Error(`http-${res.status}`);
      return await res.arrayBuffer();
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw last;
}

async function sha256Hex(parts: ArrayBuffer[]): Promise<string | null> {
  if (!globalThis.crypto?.subtle) return null;
  const all = new Uint8Array(parts.reduce((n, p) => n + p.byteLength, 0));
  let off = 0;
  for (const p of parts) {
    all.set(new Uint8Array(p), off);
    off += p.byteLength;
  }
  const digest = await crypto.subtle.digest("SHA-256", all);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * المحرك من نفس أصل المنصة (public/duckdb): بلا اعتماد على CDN، ويُجلب على أجزاء
 * صغيرة تُعاد محاولتها كلٌّ على حدة فلا يضيع التحميل كله مع الشبكة الضعيفة.
 * نتحقق من الحجم وبصمة SHA-256 قبل التشغيل. المتصفحات بلا دعم EH تعود لـ CDN.
 */
async function localBundles(): Promise<duckdb.DuckDBBundles> {
  const manifestRes = await fetch(`${LOCAL_BASE}manifest.json`, { cache: "no-cache" });
  if (!manifestRes.ok) throw new Error("local-manifest-missing");
  const manifest = (await manifestRes.json()) as LocalManifest;
  if (manifest.version !== VERSION) throw new Error("local-version-mismatch");
  const buffers = await Promise.all(manifest.parts.map((n) => fetchRetry(`${LOCAL_BASE}${n}`)));
  const size = buffers.reduce((n, b) => n + b.byteLength, 0);
  if (size !== manifest.size) throw new Error("local-size-mismatch");
  const hash = await sha256Hex(buffers);
  if (hash !== null && hash !== manifest.sha256) throw new Error("local-hash-mismatch");
  const wasmUrl = URL.createObjectURL(new Blob(buffers, { type: "application/wasm" }));
  const cdn = duckdb.getJsDelivrBundles();
  return {
    mvp: cdn.mvp,
    eh: {
      mainModule: wasmUrl,
      mainWorker: new URL(`${LOCAL_BASE}duckdb-browser-eh.worker.js`, location.origin).href,
    },
  };
}

export async function createBrowserDuckDB() {
  try {
    return await createFrom(await localBundles());
  } catch (local) {
    console.warn("DuckDB local bundle failed, trying CDN", local);
  }
  try {
    return await createFrom(duckdb.getJsDelivrBundles());
  } catch (first) {
    console.warn("DuckDB jsDelivr failed, trying unpkg", first);
    return await createFrom(unpkgBundles());
  }
}

async function createFrom(bundles: duckdb.DuckDBBundles) {
  const bundle = await duckdb.selectBundle(bundles);
  if (!bundle.mainWorker) throw new Error("duckdb-worker-unavailable");

  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts(${JSON.stringify(bundle.mainWorker)});`], {
      type: "text/javascript",
    }),
  );
  const worker = new Worker(workerUrl);
  const logger = new duckdb.VoidLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);

  const LOAD_ERROR =
    "تعذّر تحميل محرك التحليل. تأكد من اتصالك بالإنترنت (مطلوب في أول زيارة فقط) ثم أعد المحاولة.";

  // إن فشل تحميل سكربت العامل (شبكة تحجب الـ CDN أو انقطاع) لا يرد العامل أبداً،
  // فتبقى instantiate معلّقة للأبد. نسابقها مع حدث الخطأ ومهلة زمنية.
  let onError: ((e: Event) => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const failFast = new Promise<never>((_, reject) => {
    onError = () => reject(new Error(LOAD_ERROR));
    worker.addEventListener("error", onError);
    timer = setTimeout(() => reject(new Error(LOAD_ERROR)), INIT_TIMEOUT_MS);
  });

  try {
    await Promise.race([db.instantiate(bundle.mainModule, bundle.pthreadWorker), failFast]);
    return { db, worker, workerUrl };
  } catch (error) {
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
    if (onError) worker.removeEventListener("error", onError);
    failFast.catch(() => undefined);
  }
}
