/**
 * طبقة DuckDB-WASM: تعمل داخل Web Worker في المتصفح فقط.
 * تدعم الآن تسجيل مصادر متعددة وضمها عبر عمليات JOIN بسيطة.
 *
 * ✅ التعديل: إضافة دالة query() لتنفيذ أي استعلام SQL (SELECT, CREATE, DROP, إلخ).
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
/** الاسم العام لمصدر واحد. سنبني أسماء مصادر إضافية بهذا الأساس. */
export const SOURCE_TABLE = "dataset__source";

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
  private registeredSources: Record<string, { path: string; table: string }> = {};
  private generation = 0;

  private async init() {
    if (this.conn) return;
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      throw new Error("duckdb-browser-only");
    }
    if (!this.initPromise) {
      const gen = this.generation;
      this.initPromise = (async () => {
        const { createBrowserDuckDB } = await import("./duckdb-browser");
        const { db, worker, workerUrl } = await createBrowserDuckDB();
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

  /** ✅ دالة عامة لتنفيذ أي استعلام SQL (SELECT, CREATE, DROP, INSERT, إلخ) */
  async query(sql: string): Promise<any> {
    await this.init();
    const conn = this.conn!;
    return await conn.query(sql);
  }

  /** اسم جدول المصدر المستعمل لمحور alias معين */
  private sourceTableName(alias: string) {
    // صف أسماء آمنة
    return `${SOURCE_TABLE}__${alias.replace(/[^a-zA-Z0-9_]/g, "_")}`;
  }

  /** يسجّل ورقة كمصدر منفصل داخل DuckDB ويعيد الـ schema وعدد الصفوف. */
  async registerSheet(sheet: ParsedSheet, alias: string): Promise<TableInfo> {
    await this.init();
    const conn = this.conn!;
    const db = this.db!;

    const path = `${alias}-${Date.now()}.json`;
    await db.registerFileText(path, JSON.stringify(sheet.rows));
    this.registeredFiles.push(path);
    const staging = `${alias}__raw`;
    const targetTable = this.sourceTableName(alias);

    try {
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(staging)}`);
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(targetTable)}`);
      await conn.query(
        `CREATE TABLE ${quoteIdent(staging)} AS SELECT * FROM read_json_auto(${quoteLiteral(path)}, sample_size=-1, union_by_name=true)`,
      );
      const raw = await conn.query(`DESCRIBE ${quoteIdent(staging)}`);
      const projection = raw.toArray().map((r) => {
        const o = r.toJSON() as Record<string, unknown>;
        const name = String(o["column_name"]);
        const type = String(o["column_type"]).toUpperCase();
        return type === "JSON"
          ? `CAST(${quoteIdent(name)} ->> '$' AS VARCHAR) AS ${quoteIdent(name)}`
          : quoteIdent(name);
      });
      await conn.query(`CREATE TABLE ${quoteIdent(targetTable)} AS SELECT ${projection.join(", ")} FROM ${quoteIdent(staging)}`);
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(staging)}`);
    } catch {
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(staging)}`).catch(() => undefined);
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(targetTable)}`).catch(() => undefined);
      await conn.insertJSONFromPath(path, { name: targetTable, schema: "main" }).catch(() => undefined);
    }

    this.registeredSources[alias] = { path, table: targetTable };
    return this.describe(targetTable);
  }

  /** يحذف مصدر مسجّل ويحرّر الملف المسجّل. */
  async dropSource(alias: string) {
    await this.init();
    const conn = this.conn!;
    const info = this.registeredSources[alias];
    if (!info) return;
    try {
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(info.table)}`);
    } catch {
      /* ignore */
    }
    delete this.registeredSources[alias];
  }

  /** يسرد المصادر المسجلة حالياً */
  async listSources(): Promise<{ alias: string; table: string; info: TableInfo }[]> {
    await this.init();
    const out: { alias: string; table: string; info: TableInfo }[] = [];
    for (const [alias, info] of Object.entries(this.registeredSources)) {
      try {
        const t = await this.describe(info.table);
        out.push({ alias, table: info.table, info: t });
      } catch {
        // skip
      }
    }
    return out;
  }

  /** يسجّل ورقة (الواجهة القديمة) — لو لم يُمرر alias فسيُستَخدم مصدر افتراضي ويُعاد السلوك السابق */
  async loadTable(sheet: ParsedSheet, table = TABLE_NAME, alias?: string): Promise<TableInfo> {
    if (alias) {
      // سجل الورقة كمصدر منفصل ثم أنشئ view العرض بنفس اسم table (الافتراضي dataset)
      await this.registerSheet(sheet, alias);
      await this.setRelation(null, table);
      return this.describe(table);
    }

    // سلوك سابق: مسح الجداول القديمة وإنشاء مصدر وحيد
    await this.init();
    const conn = this.conn!;
    const db = this.db!;

    await conn.query(`DROP VIEW IF EXISTS ${quoteIdent(table)}`);
    await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(table)}`);
    // أحذف مصادر مسجلة قديمة
    for (const alias of Object.keys(this.registeredSources)) {
      const source = this.registeredSources[alias];
      if (!source) continue;
      try {
        await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(source.table)}`);
      } catch {
        /* ignore */
      }
    }
    this.registeredSources = {};
    await this.unregisterFiles();

    const path = `${table}-${Date.now()}.json`;
    await db.registerFileText(path, JSON.stringify(sheet.rows));
    this.registeredFiles.push(path);

    const staging = `${table}__raw`;
    try {
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(staging)}`);
      await conn.query(
        `CREATE TABLE ${quoteIdent(staging)} AS SELECT * FROM read_json_auto(${quoteLiteral(path)}, sample_size=-1, union_by_name=true)`,
      );
      const raw = await conn.query(`DESCRIBE ${quoteIdent(staging)}`);
      const projection = raw.toArray().map((r) => {
        const o = r.toJSON() as Record<string, unknown>;
        const name = String(o["column_name"]);
        const type = String(o["column_type"]).toUpperCase();
        return type === "JSON"
          ? `CAST(${quoteIdent(name)} ->> '$' AS VARCHAR) AS ${quoteIdent(name)}`
          : quoteIdent(name);
      });
      await conn.query(`CREATE TABLE ${quoteIdent(SOURCE_TABLE)} AS SELECT ${projection.join(", ")} FROM ${quoteIdent(staging)}`);
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(staging)}`);
    } catch {
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(staging)}`).catch(() => undefined);
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(SOURCE_TABLE)}`).catch(() => undefined);
      await conn.insertJSONFromPath(path, { name: SOURCE_TABLE, schema: "main" }).catch(() => undefined);
    }

    await this.setRelation(null, table);
    // سجّل المصدر الافتراضي تحت alias "main"
    this.registeredSources["main"] = { path, table: SOURCE_TABLE };
    return this.describe(table);
  }

  /** يعيد بناء الـ VIEW المعروض فوق الجدول الخام أو عبر JOIN مركب. */
  async setRelation(sql: string | null, table = TABLE_NAME): Promise<TableInfo> {
    await this.init();
    const conn = this.conn!;
    await conn.query(
      `CREATE OR REPLACE VIEW ${quoteIdent(table)} AS ${sql ?? `SELECT * FROM ${quoteIdent(SOURCE_TABLE)}`}`,
    );
    return this.describe(table);
  }

  /** ينشئ view جديد يعتمد على JOIN بين مصدرين مسجلين.
   * joinType: 'inner' | 'left' | 'right' | 'full'
   */
  async createJoin(opts: {
    leftAlias: string;
    rightAlias: string;
    leftOn: string; // عمود في اليسار
    rightOn: string; // عمود في اليمين
    joinType: "inner" | "left" | "right" | "full";
    viewName?: string;
  }): Promise<TableInfo> {
    await this.init();
    const conn = this.conn!;
    const view = opts.viewName ?? TABLE_NAME;
    const leftTable = this.sourceTableName(opts.leftAlias);
    const rightTable = this.sourceTableName(opts.rightAlias);
    const joinSqlMap: Record<string, string> = {
      inner: "INNER JOIN",
      left: "LEFT JOIN",
      right: "RIGHT JOIN",
      full: "FULL OUTER JOIN",
    };
    const joinClause = joinSqlMap[opts.joinType] ?? "INNER JOIN";

    // بناء SQL بسيط: نستخدم تسمية l و r، ونُعيد كامل الأعمدة (l.*, r.*)
    // ملاحظة: قد توجد أعمدة مكررة — يمكن للمستخدم إعادة تسمية الأعمدة لاحقاً عبر SQL مخصص.
    const sql = `SELECT l.*, r.* FROM ${quoteIdent(leftTable)} AS l ${joinClause} ${quoteIdent(
      rightTable,
    )} AS r ON l.${quoteIdent(opts.leftOn)} = r.${quoteIdent(opts.rightOn)}`;

    await conn.query(`CREATE OR REPLACE VIEW ${quoteIdent(view)} AS ${sql}`);
    return this.describe(view);
  }

  /** يقرأ الـ schema وعدد الصفوف للعرض الحالي. */
  async describe(table = TABLE_NAME): Promise<TableInfo> {
    await this.init();
    const conn = this.conn!;
    const info = await conn.query(`DESCRIBE ${quoteIdent(table)}`);
    const schema: ColumnSchema[] = info.toArray().map((r) => {
      const o = r.toJSON() as Record<string, unknown>;
      const type = String(o["column_type"]);
      return { name: String(o["column_name"]), type: type.toUpperCase() === "JSON" ? "VARCHAR" : type };
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
    offset?: number; // ✅ تمت إضافة Offset لدعم التمرير الافتراضي
  }): Promise<Row[]> {
    const table = params.table ?? TABLE_NAME;
    const where = this.buildWhere(params.columns, params.search);
    const order =
      params.sortColumn && params.columns.includes(params.sortColumn)
        ? ` ORDER BY ${quoteIdent(params.sortColumn)} ${params.sortDir === "desc" ? "DESC" : "ASC"} NULLS LAST`
        : "";
    
    // ✅ بناء جملة OFFSET
    const offsetClause = params.offset && params.offset > 0 ? ` OFFSET ${params.offset}` : "";
    
    return this.runSelect(`SELECT * FROM ${quoteIdent(table)}${where}${order}${offsetClause}`, {
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
    const parts = columns.map((c) => `lower(CAST(${quoteIdent(c)} AS VARCHAR)) LIKE ${needle}`);
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
