import * as duckdb from "@duckdb/duckdb-wasm";

/**
 * Browser-only DuckDB bootstrap. Keeping the package import in this lazy module
 * prevents its Worker-dependent module initialization from entering SSR.
 */
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

  try {
    await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
    return { db, worker, workerUrl };
  } catch (error) {
    worker.terminate();
    URL.revokeObjectURL(workerUrl);
    throw error;
  }
}