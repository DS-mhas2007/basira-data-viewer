import * as duckdb from "@duckdb/duckdb-wasm";

/**
 * Browser-only DuckDB bootstrap. Keeping the package import in this lazy module
 * prevents its Worker-dependent module initialization from entering SSR.
 */
const INIT_TIMEOUT_MS = 60_000;

export async function createBrowserDuckDB() {
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
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