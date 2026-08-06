/**
 * طبقة DuckDB-WASM: تعمل داخل Web Worker في المتصفح فقط.
 * لا واجهة استعلام حرة هنا — هذه بنية تحتية فقط.
 */
import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import type { ParsedSheet, Row } from "./parse-file";

export interface ColumnSchema {
  name: string;
  type: string;
}

export interface TableInfo {
  table: string;
  schema: ColumnSchema[];
  rowCount: number;
}

export interface QueryOptions {
  limit?: number;
  timeoutMs?: number;
}

export const DEFAULT_LIMIT = 1000;
export const DEFAULT_TIMEOUT_MS = 10_000;
export const TABLE_NAME = "dataset";

export function quoteIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

export function quoteLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

function hasLimit(sql: string) {
  return /\blimit\s+\d+/i.test(sql);
}

class DuckDBService {
  private db: AsyncDuckDB | null = null;
  private conn: AsyncDuckDBConnection | null = null;
  private worker: Worker | null = null;
  private workerUrl: string | null = null;
  private initPromise: Promise<void> | null = null;
  private registeredFiles: string[] = [];
  private generation = 0;

  private async init() {
    if (this.conn) return;
    if (!this.initPromise) {
      const gen = this.generation;
      this.initPromise = (async () => {
        const duckdb = await import("@duckdb/duckdb-wasm");
        const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
        const workerUrl = URL.createObjectURL(
          new Blob([`importScripts(${JSON.stringify(bundle.mainWorker!)});`], {
            type: "text/javascript",
          }),
        );
        const worker = new Worker(workerUrl);
        const logger = new duckdb.VoidLogger();
        const db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
        if (gen !== this.generation) {
          // تم استدعاء dispose أثناء التهيئة — تخلّص من هذه النسخة
          await db.terminate().catch(() => undefined);
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          throw new Error("aborted");
        }
        this.db = db;
        this.worker = worker;
        this.workerUrl = workerUrl;
        this.conn = await db.connect();
      })().catch((err) => {
        this.initPromise = null;
        throw err;
      });
    }
    try {
      await this.initPromise;
    } catch (err) {
      if (err instanceof Error && err.message === "aborted") {
        await this.init();
        return;
      }
      throw err;
    }
  }

  /** تحميل مسبق للمحرك في الخلفية (لا يرمي أخطاء). */
  async preload() {
    try {
      await this.init();
    } catch {
      /* سيُعاد المحاولة عند أول استخدام فعلي */
    }
  }

  get ready() {
    return this.conn !== null;
  }

  /** يسجّل الورقة المقروءة كجدول داخل DuckDB ويعيد الـ schema وعدد الصفوف. */
  async loadTable(sheet: ParsedSheet, table = TABLE_NAME): Promise<TableInfo> {
    await this.init();
    const conn = this.conn!;
    const db = this.db!;

    await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(table)}`);
    await this.unregisterFiles();

    const path = `${table}-${Date.now()}.json`;
    await db.registerFileText(path, JSON.stringify(sheet.rows));
    this.registeredFiles.push(path);
    // read_json_auto مع sample_size=-1 يفحص كل الصفوف، فلا تفشل الأعمدة مختلطة الأنواع
    const staging = `${table}__raw`;
    try {
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(staging)}`);
      await conn.query(
        `CREATE TABLE ${quoteIdent(staging)} AS SELECT * FROM read_json_auto(${quoteLiteral(path)}, sample_size=-1, union_by_name=true)`,
      );
      // الأعمدة مختلطة الأنواع تصل كنوع JSON — نحوّلها إلى نص نظيف بلا علامات اقتباس
      const raw = await conn.query(`DESCRIBE ${quoteIdent(staging)}`);
      const projection = raw.toArray().map((r) => {
        const o = r.toJSON() as Record<string, unknown>;
        const name = String(o["column_name"]);
        const type = String(o["column_type"]).toUpperCase();
        return type === "JSON"
          ? `(${quoteIdent(name)} ->> '$') AS ${quoteIdent(name)}`
          : quoteIdent(name);
      });
      await conn.query(
        `CREATE TABLE ${quoteIdent(table)} AS SELECT ${projection.join(", ")} FROM ${quoteIdent(staging)}`,
      );
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(staging)}`);
    } catch {
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(staging)}`);
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(table)}`);
      await conn.insertJSONFromPath(path, { name: table, schema: "main" });
    }

    const info = await conn.query(`DESCRIBE ${quoteIdent(table)}`);
    const schema: ColumnSchema[] = info.toArray().map((r) => {
      const o = r.toJSON() as Record<string, unknown>;
      return { name: String(o["column_name"]), type: String(o["column_type"]) };
    });

    const countRes = await conn.query(`SELECT count(*)::BIGINT AS n FROM ${quoteIdent(table)}`);
    const rowCount = Number((countRes.toArray()[0]?.toJSON() as { n: bigint | number }).n ?? 0);

    return { table, schema, rowCount };
  }

  /** ينفذ استعلام SELECT فقط، مع LIMIT افتراضي ومهلة زمنية. */
  async runSelect(sql: string, options: QueryOptions = {}): Promise<Row[]> {
    const { limit = DEFAULT_LIMIT, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
    const trimmed = sql.trim().replace(/;+\s*$/, "");
    if (!/^\s*(select|with)\b/i.test(trimmed)) {
      throw new Error("يُسمح باستعلامات SELECT فقط.");
    }
    await this.init();
    const conn = this.conn!;
    const finalSql = hasLimit(trimmed) ? trimmed : `${trimmed} LIMIT ${limit}`;

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await Promise.race([
        conn.query(finalSql),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            void conn.cancelSent().catch(() => undefined);
            reject(new Error("انتهت مهلة تنفيذ الاستعلام (10 ثوانٍ)."));
          }, timeoutMs);
        }),
      ]);
      return result.toArray().map((r) => {
        const obj = r.toJSON() as Record<string, unknown>;
        const out: Row = {};
        for (const [k, v] of Object.entries(obj)) {
          out[k] =
            v === null || v === undefined
              ? null
              : typeof v === "bigint"
                ? Number(v)
                : typeof v === "number" || typeof v === "boolean" || typeof v === "string"
                  ? v
                  : String(v);
        }
        return out;
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** قراءة صفحة عرض: بحث نصي عام + فرز اختياري. */
  async fetchRows(params: {
    table?: string;
    columns: string[];
    search?: string;
    sortColumn?: string | null;
    sortDir?: "asc" | "desc";
    limit?: number;
  }): Promise<Row[]> {
    const table = params.table ?? TABLE_NAME;
    const where = this.buildWhere(params.columns, params.search);
    const order =
      params.sortColumn && params.columns.includes(params.sortColumn)
        ? ` ORDER BY ${quoteIdent(params.sortColumn)} ${params.sortDir === "desc" ? "DESC" : "ASC"} NULLS LAST`
        : "";
    return this.runSelect(`SELECT * FROM ${quoteIdent(table)}${where}${order}`, {
      limit: params.limit ?? 100,
    });
  }

  /** عدد الصفوف المطابقة للبحث الحالي. */
  async countRows(columns: string[], search?: string, table = TABLE_NAME): Promise<number> {
    const rows = await this.runSelect(
      `SELECT count(*)::BIGINT AS n FROM ${quoteIdent(table)}${this.buildWhere(columns, search)}`,
      { limit: 1 },
    );
    return Number(rows[0]?.["n"] ?? 0);
  }

  private buildWhere(columns: string[], search?: string) {
    const q = (search ?? "").trim();
    if (!q || columns.length === 0) return "";
    const needle = quoteLiteral(`%${q.toLowerCase()}%`);
    const parts = columns.map(
      (c) => `lower(CAST(${quoteIdent(c)} AS VARCHAR)) LIKE ${needle}`,
    );
    return ` WHERE ${parts.join(" OR ")}`;
  }

  private async unregisterFiles() {
    if (!this.db) return;
    for (const f of this.registeredFiles) {
      await this.db.dropFile(f).catch(() => undefined);
    }
    this.registeredFiles = [];
  }

  /** ينظّف الاتصال والـ Worker والذاكرة. */
  async dispose() {
    this.generation += 1;
    try {
      await this.unregisterFiles();
      await this.conn?.close();
      await this.db?.terminate();
    } catch {
      /* تجاهل أخطاء الإغلاق */
    }
    this.worker?.terminate();
    if (this.workerUrl) URL.revokeObjectURL(this.workerUrl);
    this.conn = null;
    this.db = null;
    this.worker = null;
    this.workerUrl = null;
    this.initPromise = null;
  }
}

export const duckdb = new DuckDBService();