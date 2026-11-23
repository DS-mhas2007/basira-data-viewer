/**
 * طبقة DuckDB-WASM: تعمل داخل Web Worker في المتصفح فقط.
 * تدعم الآن تسجيل مصادر متعددة وضمها عبر عمليات JOIN بسيطة.
 *
 * ✅ التعديل: إضافة دالة query() لتنفيذ أي استعلام SQL (SELECT, CREATE, DROP, إلخ).
 */
import type { AsyncDuckDB, AsyncDuckDBConnection } from "@duckdb/duckdb-wasm";
import type { ParsedSheet, Row } from "./parse-file";
import { ensureLimit } from "./sql-tokenize";
import { convertCell } from "./arrow-values";
import { computeDatasetContentFingerprint } from "@/lib/dataset-content-fingerprint";
import { finalizeDatasetOutputFingerprint } from "@/lib/dataset-output-fingerprint";
import { clearCleaningExecutionAttestation } from "@/lib/cleaning-execution-attestation";

export interface ColumnSchema {
  name: string;
  type: string;
}

export type JoinRelationship = "no-match" | "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";

export interface JoinDiagnostics {
  relationship: JoinRelationship;
  leftRows: number;
  rightRows: number;
  joinedRows: number;
  matchedLeftRows: number;
  matchedRightRows: number;
  unmatchedLeftRows: number;
  unmatchedRightRows: number;
  leftDuplicateKeyGroups: number;
  rightDuplicateKeyGroups: number;
  matchedKeyGroups: number;
  leftMaxKeyFrequency: number;
  rightMaxKeyFrequency: number;
  expansionFactor: number;
  warning: boolean;
  reasons: string[];
}

export interface TableInfo {
  table: string;
  schema: ColumnSchema[];
  rowCount: number;
  joinDiagnostics?: JoinDiagnostics;
}

/** Convert DuckDB integer diagnostics without silently rounding beyond JS safe-integer precision. */
export function toSafeDiagnosticNumber(value: unknown, field = "value"): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "bigint") {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new Error(`قيمة التشخيص «${field}» تتجاوز دقة الأعداد الآمنة في JavaScript؛ لا يمكن عرضها كعدد دقيق.`);
    }
    return Number(value);
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new Error(`قيمة التشخيص «${field}» تتجاوز دقة الأعداد الآمنة في JavaScript؛ لا يمكن عرضها كعدد دقيق.`);
    }
    return value;
  }
  if (typeof value === "string" && /^-?\d+$/.test(value)) {
    return toSafeDiagnosticNumber(BigInt(value), field);
  }
  // Arrow/ DuckDB-WASM may expose HUGEINT values through integer wrapper objects.
  if (typeof value === "object" && value !== null) {
    const integerText = String(value);
    if (/^-?\d+$/.test(integerText)) {
      return toSafeDiagnosticNumber(BigInt(integerText), field);
    }
  }
  throw new Error(`تعذر تحويل قيمة التشخيص «${field}» إلى عدد صحيح آمن.`);
}

export function classifyJoinRelationship(leftMaxFrequency: number, rightMaxFrequency: number): JoinRelationship {
  if (leftMaxFrequency === 0 || rightMaxFrequency === 0) return "no-match";
  const leftMany = leftMaxFrequency > 1;
  const rightMany = rightMaxFrequency > 1;
  if (leftMany && rightMany) return "many-to-many";
  if (leftMany) return "many-to-one";
  if (rightMany) return "one-to-many";
  return "one-to-one";
}

export interface QueryOptions {
  limit?: number;
  timeoutMs?: number;
  signal?: AbortSignal | undefined;
}

export const DEFAULT_LIMIT = 1000;
export const DEFAULT_TIMEOUT_MS = 10_000;

/** Conservative classifier: only plain SELECT and planning-only EXPLAIN are read-only. */
export function isReadOnlyDuckDbStatement(sql: string): boolean {
  // EXPLAIN (FORMAT JSON) is planning-only too; keep the accepted grammar narrow.
  // WITH is deliberately excluded because DuckDB permits data-modifying CTEs.
  return /^\s*(?:select\b|explain\s+(?!analyze\b)(?:\(\s*format\s+(?:json|text|html)\s*\)\s*)?select\b)/i.test(sql);
}
export const TABLE_NAME = "dataset";
/** الاسم العام لمصدر واحد. سنبني أسماء مصادر إضافية بهذا الأساس. */
export const SOURCE_TABLE = "dataset__source";

export function quoteIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

export function quoteLiteral(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}
/** Exact row-count diagnostics without materializing the full joined relation. */
export function buildJoinDiagnosticsSql(
  leftTable: string, rightTable: string, leftColumn: string, rightColumn: string,
  joinType: "inner" | "left" | "right" | "full",
): string {
  const leftKey = quoteIdent(leftColumn), rightKey = quoteIdent(rightColumn);
  return `
    WITH left_frequency AS (
      SELECT ${leftKey} AS join_key, COUNT(*)::HUGEINT AS frequency
      FROM ${quoteIdent(leftTable)} WHERE ${leftKey} IS NOT NULL GROUP BY ${leftKey}
    ),
    right_frequency AS (
      SELECT ${rightKey} AS join_key, COUNT(*)::HUGEINT AS frequency
      FROM ${quoteIdent(rightTable)} WHERE ${rightKey} IS NOT NULL GROUP BY ${rightKey}
    ),
    matched_frequency AS (
      SELECT lf.join_key, lf.frequency AS left_frequency, rf.frequency AS right_frequency
      FROM left_frequency lf INNER JOIN right_frequency rf ON lf.join_key = rf.join_key
    ),
    totals AS (
      SELECT
        COALESCE(SUM(left_frequency * right_frequency), 0)::HUGEINT AS matched_rows,
        COALESCE(SUM(left_frequency), 0)::HUGEINT AS matched_left_rows,
        COALESCE(SUM(right_frequency), 0)::HUGEINT AS matched_right_rows
      FROM matched_frequency
    ),
    source_totals AS (
      SELECT
        (SELECT COUNT(*)::HUGEINT FROM ${quoteIdent(leftTable)}) AS left_rows,
        (SELECT COUNT(*)::HUGEINT FROM ${quoteIdent(rightTable)}) AS right_rows
    )
    SELECT
      source_totals.left_rows, source_totals.right_rows,
      totals.matched_left_rows, totals.matched_right_rows,
      (SELECT COUNT(*)::BIGINT FROM matched_frequency WHERE left_frequency > 1) AS left_duplicate_groups,
      (SELECT COUNT(*)::BIGINT FROM matched_frequency WHERE right_frequency > 1) AS right_duplicate_groups,
      COALESCE((SELECT MAX(left_frequency) FROM matched_frequency), 0)::HUGEINT AS left_max_frequency,
      COALESCE((SELECT MAX(right_frequency) FROM matched_frequency), 0)::HUGEINT AS right_max_frequency,
      (SELECT COUNT(*)::BIGINT FROM matched_frequency) AS matched_key_groups,
      CASE
        WHEN '${joinType}' = 'inner' THEN totals.matched_rows
        WHEN '${joinType}' = 'left' THEN totals.matched_rows + source_totals.left_rows - totals.matched_left_rows
        WHEN '${joinType}' = 'right' THEN totals.matched_rows + source_totals.right_rows - totals.matched_right_rows
        ELSE totals.matched_rows + source_totals.left_rows - totals.matched_left_rows
          + source_totals.right_rows - totals.matched_right_rows
      END::HUGEINT AS joined_rows
    FROM source_totals CROSS JOIN totals
  `;
}


function createAbortError() {
  const error = new Error("تم إلغاء الاستعلام لأن طلباً أحدث بدأ التنفيذ.");
  error.name = "AbortError";
  return error;
}

class DuckDBService {
  private db: AsyncDuckDB | null = null;
  private conn: AsyncDuckDBConnection | null = null;
  private worker: Worker | null = null;
  private workerUrl: string | null = null;
  private initPromise: Promise<void> | null = null;
  private registeredFiles: string[] = [];
  private registeredSources: Record<string, { path: string; table: string; contentFingerprint?: string | null }> = {};
  private activeSourceAlias: string | null = null;
  private activeSourceRevision = 0;
  private activeRelationRevision = 0;
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
  async query(sql: string, options: { internal?: boolean } = {}): Promise<unknown> {
    await this.init();
    const conn = this.conn!;
    // WITH may contain DML, and EXPLAIN ANALYZE executes its statement.
    // Internal KNN staging tables are isolated from the active dataset relation.
    if (!options.internal && !isReadOnlyDuckDbStatement(sql)) {
      this.activeRelationRevision += 1;
      clearCleaningExecutionAttestation();
    }
    return await conn.query(sql);
  }

  /** اسم جدول المصدر المستعمل لمحور alias معين */
  private sourceTableName(alias: string) {
    // أسماء آمنة + بصمة قصيرة لتفادي التصادم مع الأسماء غير اللاتينية (عربية مثلاً)
    const safe = alias.replace(/[^a-zA-Z0-9_]/g, "_");
    let hash = 0;
    for (let i = 0; i < alias.length; i++) hash = (hash * 31 + alias.charCodeAt(i)) >>> 0;
    return `${SOURCE_TABLE}__${safe}_${hash.toString(36)}`;
  }

  /** يسجّل ورقة كمصدر منفصل داخل DuckDB ويعيد الـ schema وعدد الصفوف. */
  async registerSheet(sheet: ParsedSheet, alias: string, contentFingerprint?: string | null): Promise<TableInfo> {
    await this.init();
    const resolvedContentFingerprint = contentFingerprint ?? await computeDatasetContentFingerprint(sheet.columns, sheet.rows);
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
      await conn.query(
        `CREATE TABLE ${quoteIdent(targetTable)} AS SELECT ${projection.join(", ")} FROM ${quoteIdent(staging)}`,
      );
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(staging)}`);
    } catch {
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(staging)}`).catch(() => undefined);
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(targetTable)}`).catch(() => undefined);
      await conn
        .insertJSONFromPath(path, { name: targetTable, schema: "main" })
        .catch(() => undefined);
    }

    // الجداول أُنشئت (CREATE TABLE AS)، فلا حاجة لنسخة JSON المسجّلة في ذاكرة WASM (قد تبلغ 25MB لكل رفع)
    await db.dropFile(path).catch(() => undefined);
    this.registeredFiles = this.registeredFiles.filter((f) => f !== path);

    clearCleaningExecutionAttestation();
    this.registeredSources[alias] = { path, table: targetTable, contentFingerprint: resolvedContentFingerprint };
    this.activeSourceAlias = alias;
    this.activeSourceRevision += 1;
    this.activeRelationRevision += 1;
    // اجعل هذا المصدر هو المصدر الأساسي الذي يشير إليه dataset__source
    await this.setPrimarySource(targetTable);
    return this.describe(targetTable);
  }

  /** يجعل dataset__source يشير إلى جدول المصدر المطلوب (عبر VIEW). */
  private async setPrimarySource(targetTable: string) {
    const conn = this.conn!;
    if (targetTable === SOURCE_TABLE) return;
    await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(SOURCE_TABLE)}`).catch(() => undefined);
    await conn.query(
      `CREATE OR REPLACE VIEW ${quoteIdent(SOURCE_TABLE)} AS SELECT * FROM ${quoteIdent(targetTable)}`,
    );
  }

  /** يحذف مصدر مسجّل ويحرّر الملف المسجّل. */
  async dropSource(alias: string) {
    await this.init();
    const conn = this.conn!;
    const info = this.registeredSources[alias];
    if (!info) return;

    // Remove default views before dropping their backing table to avoid dependencies.
    await conn.query(`DROP VIEW IF EXISTS ${quoteIdent(TABLE_NAME)}`).catch(() => undefined);
    await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(TABLE_NAME)}`).catch(() => undefined);
    await conn.query(`DROP VIEW IF EXISTS ${quoteIdent(SOURCE_TABLE)}`).catch(() => undefined);
    await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(SOURCE_TABLE)}`).catch(() => undefined);
    await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(info.table)}`);
    this.activeRelationRevision += 1;
    clearCleaningExecutionAttestation();

    delete this.registeredSources[alias];
    if (this.activeSourceAlias === alias) { this.activeSourceAlias = null; this.activeSourceRevision += 1; }
    const nextEntry = Object.entries(this.registeredSources)[0];
    if (nextEntry) {
      const [nextAlias, next] = nextEntry;
      // Source deletion is already committed in memory. A failure to rebuild
      // the convenience views must not abort the owning manifest/payload cleanup.
      await this.setPrimarySource(next.table).catch(() => undefined);
      await this.activateSource(nextAlias).catch((error) =>
        console.warn("[mizya] fallback source activation failed", error),
      );
    }
  }

  /** Switches the default dataset view to one already-registered source. */
  async activateSource(alias: string, view = TABLE_NAME): Promise<TableInfo> {
    await this.init();
    const source = this.registeredSources[alias];
    if (!source) throw new Error("duckdb-source-not-found");
    clearCleaningExecutionAttestation();
    // Keep the transformation base relation and the visible dataset view on the same source.
    await this.setPrimarySource(source.table);
    await this.conn!.query(
      `CREATE OR REPLACE VIEW ${quoteIdent(view)} AS SELECT * FROM ${quoteIdent(source.table)}`,
    );
    this.activeSourceAlias = alias;
    this.activeSourceRevision += 1;
    this.activeRelationRevision += 1;
    return this.describe(view);
  }

  /** Clears the in-memory source registry before hydrating a different project. */
  async clearSources(): Promise<void> {
    await this.init();
    const conn = this.conn!;
    await conn.query(`DROP VIEW IF EXISTS ${quoteIdent(TABLE_NAME)}`).catch(() => undefined);
    await conn.query(`DROP VIEW IF EXISTS ${quoteIdent(SOURCE_TABLE)}`).catch(() => undefined);
    for (const source of Object.values(this.registeredSources)) {
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(source.table)}`).catch(() => undefined);
    }
    this.registeredSources = {};
    this.activeSourceAlias = null;
    this.activeSourceRevision += 1;
    this.activeRelationRevision += 1;
    clearCleaningExecutionAttestation();
    await this.unregisterFiles();
  }

  /** Returns the independently computed content identity attached at file parsing time. */
  getSourceContentFingerprint(alias: string | null | undefined): string | null {
    if (!alias) return null;
    return this.registeredSources[alias]?.contentFingerprint ?? null;
  }

  /** Schemas for all currently registered source relations; excludes transient/internal tables. */
  async getRegisteredSourceSchemas(): Promise<Array<{ table: string; aliases: string[]; columns: ColumnSchema[] }>> {
    await this.init();
    const entries = Object.entries(this.registeredSources);
    const schemas: Array<{ table: string; aliases: string[]; columns: ColumnSchema[] }> = [];
    for (const [alias, source] of entries) {
      try {
        const info = await this.describe(source.table);
        if (info.schema.length) schemas.push({ table: source.table, aliases: [alias], columns: info.schema });
      } catch {
        // A source removed concurrently is omitted; callers must fail closed if SQL references it.
      }
    }
    return schemas;
  }

  /** Identity of the single registered source currently backing the active dataset view. */
  getActiveSourceIdentity(): { alias: string; contentFingerprint: string; sourceRevision: number; relationRevision: number } | null {
    const alias = this.activeSourceAlias;
    const contentFingerprint = this.getSourceContentFingerprint(alias);
    return alias && contentFingerprint ? { alias, contentFingerprint, sourceRevision: this.activeSourceRevision, relationRevision: this.activeRelationRevision } : null;
  }

  getActiveRelationRevision(): number {
    return this.activeRelationRevision;
  }

  /**
   * Fingerprint the actual active relation, independently of its declared recipe.
   * Rows are canonicalized by DuckDB JSON serialization, grouped to retain exact
   * duplicate multiplicity, sorted, and fetched in bounded pages.
   */
  async computeOutputFingerprint(table = TABLE_NAME): Promise<string> {
    await this.init();
    const conn = this.conn!;
    const info = await this.describe(table);
    if (info.schema.length === 0) throw new Error("Cannot fingerprint an output without a schema.");
    const fields = info.schema.map((column) =>
      `${quoteIdent(column.name)} := ${quoteIdent(column.name)}`,
    ).join(", ");
    const nonFiniteChecks = info.schema
      .filter((item) => /^(FLOAT|DOUBLE|REAL)\b/i.test(item.type))
      .map((item) => `(${quoteIdent(item.name)} IS NOT NULL AND (isnan(${quoteIdent(item.name)}) OR isinf(${quoteIdent(item.name)})))`);
    const nonFiniteCount = nonFiniteChecks.length
      ? `coalesce(sum(CASE WHEN ${nonFiniteChecks.join(" OR ")} THEN 1 ELSE 0 END), 0)::VARCHAR`
      : "'0'";
    const chunkQuery = `WITH canonical AS (
      SELECT CAST(to_json(struct_pack(${fields})) AS VARCHAR) AS row_json
      FROM ${quoteIdent(table)}
    ),
    stats AS (
      SELECT count(*)::VARCHAR AS total_rows, ${nonFiniteCount} AS non_finite_count
      FROM ${quoteIdent(table)}
    ),
    grouped AS (
      SELECT row_json, count(*)::VARCHAR AS frequency
      FROM canonical
      GROUP BY row_json
    ),
    ordered AS (
      SELECT row_json, frequency, row_number() OVER (ORDER BY row_json) AS row_num
      FROM grouped
    ),
    chunks AS (
      SELECT
        CAST(FLOOR((row_num - 1) / 128) AS BIGINT) AS chunk_id,
        sha256(string_agg(length(row_json)::VARCHAR || ':' || row_json || ':' || frequency, chr(10) ORDER BY row_json)) AS chunk_digest
      FROM ordered
      GROUP BY chunk_id
    )
    SELECT chunks.chunk_id, chunks.chunk_digest, stats.total_rows, stats.non_finite_count
    FROM stats LEFT JOIN chunks ON TRUE
    ORDER BY chunks.chunk_id`;
    const chunkResult = await conn.query(chunkQuery);
    const resultRows = chunkResult.toArray();
    if (resultRows.length === 0) throw new Error("DuckDB returned no output fingerprint evidence.");
    let totalRows: string | null = null;
    let nonFiniteCountValue: string | null = null;
    const chunkDigests: string[] = [];
    for (let index = 0; index < resultRows.length; index++) {
      const value = resultRows[index]!.toJSON() as Record<string, unknown>;
      const currentTotal = String(value["total_rows"] ?? "");
      const currentNonFinite = String(value["non_finite_count"] ?? "");
      if (totalRows === null) {
        totalRows = currentTotal;
        nonFiniteCountValue = currentNonFinite;
      } else if (totalRows !== currentTotal || nonFiniteCountValue !== currentNonFinite) {
        throw new Error("DuckDB returned inconsistent output fingerprint metadata.");
      }
      if (value["chunk_id"] === null || value["chunk_id"] === undefined) {
        if (value["chunk_digest"] !== null && value["chunk_digest"] !== undefined) {
          throw new Error("DuckDB returned an invalid empty output chunk.");
        }
        continue;
      }
      if (String(value["chunk_id"]) !== String(chunkDigests.length) || typeof value["chunk_digest"] !== "string" || !/^[0-9a-f]{64}$/.test(value["chunk_digest"])) {
        throw new Error("DuckDB returned incomplete or unordered output chunk evidence.");
      }
      chunkDigests.push(value["chunk_digest"]);
    }
    if (totalRows === null || !/^(0|[1-9]\d*)$/.test(totalRows)) {
      throw new Error("Could not read an exact output row count.");
    }
    if (nonFiniteCountValue !== "0") {
      throw new Error("Non-finite floating-point values cannot be fingerprinted losslessly.");
    }

    return finalizeDatasetOutputFingerprint(info.schema, totalRows, chunkDigests);
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
  async loadTable(sheet: ParsedSheet, table = TABLE_NAME, alias?: string, contentFingerprint?: string | null): Promise<TableInfo> {
    if (alias) {
      // سجل الورقة كمصدر منفصل ثم أنشئ view العرض بنفس اسم table (الافتراضي dataset)
      await this.registerSheet(sheet, alias, contentFingerprint);
      await this.setRelation(null, table);
      return this.describe(table);
    }

    // سلوك سابق: مسح الجداول القديمة وإنشاء مصدر وحيد
    await this.init();
    const resolvedContentFingerprint = contentFingerprint ?? await computeDatasetContentFingerprint(sheet.columns, sheet.rows);
    const conn = this.conn!;
    const db = this.db!;

    await conn.query(`DROP VIEW IF EXISTS ${quoteIdent(table)}`);
    await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(table)}`);
    await conn.query(`DROP VIEW IF EXISTS ${quoteIdent(SOURCE_TABLE)}`).catch(() => undefined);
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
      await conn.query(
        `CREATE TABLE ${quoteIdent(SOURCE_TABLE)} AS SELECT ${projection.join(", ")} FROM ${quoteIdent(staging)}`,
      );
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(staging)}`);
    } catch {
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(staging)}`).catch(() => undefined);
      await conn.query(`DROP TABLE IF EXISTS ${quoteIdent(SOURCE_TABLE)}`).catch(() => undefined);
      await conn
        .insertJSONFromPath(path, { name: SOURCE_TABLE, schema: "main" })
        .catch(() => undefined);
    }

    await this.setRelation(null, table);
    // سجّل المصدر الافتراضي تحت alias "main"
    this.registeredSources["main"] = { path, table: SOURCE_TABLE, contentFingerprint: resolvedContentFingerprint };
    this.activeSourceAlias = "main";
    this.activeSourceRevision += 1;
    this.activeRelationRevision += 1;
    return this.describe(table);
  }

  /** يعيد بناء الـ VIEW المعروض فوق الجدول الخام أو عبر JOIN مركب. */
  async setRelation(
    sql: string | null,
    table = TABLE_NAME,
    expectedSource?: { alias: string; contentFingerprint: string; sourceRevision: number; relationRevision: number },
  ): Promise<TableInfo> {
    await this.init();
    // A cleaning job may have awaited KNN materialization while the user switched sources.
    // Refuse to publish its stale relation over the newly active dataset.
    if (expectedSource) {
      const active = this.getActiveSourceIdentity();
      if (
        !active ||
        active.alias !== expectedSource.alias ||
        active.contentFingerprint !== expectedSource.contentFingerprint ||
        active.sourceRevision !== expectedSource.sourceRevision ||
        active.relationRevision !== expectedSource.relationRevision
      ) {
        throw new Error("active-source-changed-before-relation-update");
      }
    }
    clearCleaningExecutionAttestation();
    this.activeRelationRevision += 1;
    const conn = this.conn!;
    await conn.query(
      `CREATE OR REPLACE VIEW ${quoteIdent(table)} AS ${sql ?? `SELECT * FROM ${quoteIdent(SOURCE_TABLE)}`}`,
    );
    return this.describe(table);
  }

  /** Read-only join profile: no VIEW or active-source mutation. */
  async diagnoseJoin(opts: {
    leftAlias: string; rightAlias: string; leftOn: string; rightOn: string;
    joinType: "inner" | "left" | "right" | "full";
  }): Promise<JoinDiagnostics> {
    await this.init();
    const leftTable = this.sourceTableName(opts.leftAlias), rightTable = this.sourceTableName(opts.rightAlias);
    const result = await this.conn!.query(buildJoinDiagnosticsSql(leftTable, rightTable, opts.leftOn, opts.rightOn, opts.joinType));
    const profile = result.toArray()[0]?.toJSON() as Record<string, unknown> | undefined;
    if (!profile) throw new Error("تعذر فحص مفاتيح الربط قبل الدمج.");
    const number = (key: string) => toSafeDiagnosticNumber(profile[key], key);
    const leftRows = number("left_rows"), rightRows = number("right_rows"), joinedRows = number("joined_rows");
    const matchedLeftRows = number("matched_left_rows"), matchedRightRows = number("matched_right_rows");
    const unmatchedLeftRows = leftRows - matchedLeftRows, unmatchedRightRows = rightRows - matchedRightRows;
    const leftMaxKeyFrequency = number("left_max_frequency"), rightMaxKeyFrequency = number("right_max_frequency");
    const relationship = classifyJoinRelationship(leftMaxKeyFrequency, rightMaxKeyFrequency);
    const reasons: string[] = [];
    if (relationship === "no-match") reasons.push("لم يتم العثور على أي مفتاح مشترك غير فارغ بين الجدولين.");
    if (relationship === "many-to-many") reasons.push("مفتاح الربط مكرر في الجدولين؛ قد ينتج تضاعف تركيبي للصفوف.");
    else if (relationship === "one-to-many" || relationship === "many-to-one") reasons.push("مفتاح الربط مكرر في أحد الجدولين؛ راجع مستوى تفصيل البيانات قبل جمع المقاييس.");
    if (opts.joinType === "inner" && (unmatchedLeftRows > 0 || unmatchedRightRows > 0)) {
      reasons.push(`INNER JOIN سيستبعد ${unmatchedLeftRows.toLocaleString("en-US")} صفاً غير مطابق من المصدر الأيسر و${unmatchedRightRows.toLocaleString("en-US")} من المصدر الأيمن.`);
    } else if (opts.joinType === "left" && unmatchedRightRows > 0) {
      reasons.push(`LEFT JOIN لن يتضمن ${unmatchedRightRows.toLocaleString("en-US")} صفاً غير مطابق من المصدر الأيمن.`);
    } else if (opts.joinType === "right" && unmatchedLeftRows > 0) {
      reasons.push(`RIGHT JOIN لن يتضمن ${unmatchedLeftRows.toLocaleString("en-US")} صفاً غير مطابق من المصدر الأيسر.`);
    }
    const expansionFactor = joinedRows / Math.max(leftRows, rightRows, 1);
    if (expansionFactor > 1.05) reasons.push(`عدد صفوف الدمج أكبر من أكبر مصدر بنسبة ${expansionFactor.toFixed(2)}x.`);
    return {
      relationship, leftRows, rightRows, joinedRows,
      matchedLeftRows, matchedRightRows, unmatchedLeftRows, unmatchedRightRows,
      leftDuplicateKeyGroups: number("left_duplicate_groups"), rightDuplicateKeyGroups: number("right_duplicate_groups"),
      matchedKeyGroups: number("matched_key_groups"), leftMaxKeyFrequency, rightMaxKeyFrequency,
      expansionFactor, warning: reasons.length > 0, reasons,
    };
  }

  /** Creates a join view after collecting exact cardinality diagnostics. */
  async createJoin(opts: {
    leftAlias: string; rightAlias: string; leftOn: string; rightOn: string;
    joinType: "inner" | "left" | "right" | "full"; viewName?: string;
  }): Promise<TableInfo> {
    await this.init();
    const view = opts.viewName ?? TABLE_NAME;
    const leftTable = this.sourceTableName(opts.leftAlias), rightTable = this.sourceTableName(opts.rightAlias);
    const joinSqlMap = { inner: "INNER JOIN", left: "LEFT JOIN", right: "RIGHT JOIN", full: "FULL OUTER JOIN" } as const;
    const leftKey = quoteIdent(opts.leftOn), rightKey = quoteIdent(opts.rightOn);
    const diagnostics = await this.diagnoseJoin(opts);
    const sql = `SELECT l.*, r.* FROM ${quoteIdent(leftTable)} AS l ${joinSqlMap[opts.joinType]} ${quoteIdent(rightTable)} AS r ON l.${leftKey} = r.${rightKey}`;
    await this.conn!.query(`CREATE OR REPLACE VIEW ${quoteIdent(view)} AS ${sql}`);
    // A joined relation is not identified by one source fingerprint.
    if (view === TABLE_NAME) { this.activeSourceAlias = null; this.activeSourceRevision += 1; this.activeRelationRevision += 1; clearCleaningExecutionAttestation(); }
    return { ...(await this.describe(view)), joinDiagnostics: diagnostics };
  }

  /** يقرأ الـ schema وعدد الصفوف للعرض الحالي. */
  async describe(table = TABLE_NAME): Promise<TableInfo> {
    await this.init();
    const conn = this.conn!;
    const info = await conn.query(`DESCRIBE ${quoteIdent(table)}`);
    const schema: ColumnSchema[] = info.toArray().map((r) => {
      const o = r.toJSON() as Record<string, unknown>;
      const type = String(o["column_type"]);
      return {
        name: String(o["column_name"]),
        type: type.toUpperCase() === "JSON" ? "VARCHAR" : type,
      };
    });

    const countRes = await conn.query(`SELECT count(*)::BIGINT AS n FROM ${quoteIdent(table)}`);
    const rowCount = Number((countRes.toArray()[0]?.toJSON() as { n: bigint | number }).n ?? 0);

    return { table, schema, rowCount };
  }

  /**
   * Returns DuckDB's physical plan as structured JSON when supported.
   * EXPLAIN is planning-only; it does not execute the SELECT again.
   * Unsupported DuckDB builds or plan formats safely return null.
   */
  async explainSelect(sql: string): Promise<unknown | null> {
    const trimmed = sql.trim().replace(/;+\s*$/, "");
    if (!/^\s*(select|with)\b/i.test(trimmed) || trimmed.length > 20_000) return null;
    try {
      await this.init();
      const result = await this.conn!.query(`EXPLAIN (FORMAT JSON) ${trimmed}`);
      return result.toArray().map((row) => row.toJSON());
    } catch {
      // EXPLAIN JSON is an optional enhancement; never block a successful analysis.
      return null;
    }
  }

  /** ينفذ استعلام SELECT فقط، مع LIMIT افتراضي ومهلة زمنية. */
  async runSelect(sql: string, options: QueryOptions = {}): Promise<Row[]> {
    const { limit = DEFAULT_LIMIT, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
    const trimmed = sql.trim().replace(/;+\s*$/, "");
    if (!/^\s*(select|with)\b/i.test(trimmed)) {
      throw new Error("يُسمح باستعلامات SELECT فقط.");
    }
    if (signal?.aborted) throw createAbortError();
    await this.init();
    if (signal?.aborted) throw createAbortError();
    const conn = this.conn!;
    const finalSql = ensureLimit(trimmed, limit);

    let timer: ReturnType<typeof setTimeout> | undefined;
    let removeAbortListener: (() => void) | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          void conn.cancelSent().catch(() => undefined);
          reject(new Error("انتهت مهلة تنفيذ الاستعلام (10 ثوانٍ)."));
        }, timeoutMs);
      });
      const abortPromise = signal
        ? new Promise<never>((_, reject) => {
            const onAbort = () => {
              void conn.cancelSent().catch(() => undefined);
              reject(createAbortError());
            };
            if (signal.aborted) onAbort();
            else {
              signal.addEventListener("abort", onAbort, { once: true });
              removeAbortListener = () => signal.removeEventListener("abort", onAbort);
            }
          })
        : undefined;
      type QueryResult = Awaited<ReturnType<AsyncDuckDBConnection["query"]>>;
      const pending: Promise<QueryResult>[] = [
        conn.query(finalSql),
        timeoutPromise as Promise<QueryResult>,
      ];
      if (abortPromise) pending.push(abortPromise as Promise<QueryResult>);
      const result = await Promise.race(pending);
      // نوع كل عمود يحدد طريقة التحويل (تاريخ/وقت/عشري) بدل التخمين من القيمة
      const types = new Map(
        result.schema.fields.map((f) => [
          f.name,
          { id: f.type.typeId as number, scale: (f.type as { scale?: number }).scale },
        ]),
      );
      return result.toArray().map((r) => {
        const obj = r.toJSON() as Record<string, unknown>;
        const out: Row = {};
        for (const [k, v] of Object.entries(obj)) {
          const t = types.get(k);
          out[k] = convertCell(t?.id, t?.scale, v) as Row[string];
        }
        return out;
      });
    } finally {
      if (timer) clearTimeout(timer);
      removeAbortListener?.();
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
    signal?: AbortSignal | undefined;
  }): Promise<Row[]> {
    const table = params.table ?? TABLE_NAME;
    const projection =
      params.columns.length > 0
        ? params.columns.map((column) => quoteIdent(column)).join(", ")
        : "*";
    const where = this.buildWhere(params.columns, params.search);
    const order =
      params.sortColumn && params.columns.includes(params.sortColumn)
        ? ` ORDER BY ${quoteIdent(params.sortColumn)} ${params.sortDir === "desc" ? "DESC" : "ASC"} NULLS LAST`
        : "";

    // ✅ بناء جملة OFFSET
    const offsetClause = params.offset && params.offset > 0 ? ` OFFSET ${params.offset}` : "";

    return this.runSelect(
      `SELECT ${projection} FROM ${quoteIdent(table)}${where}${order}${offsetClause}`,
      {
        limit: params.limit ?? 100,
        signal: params.signal,
      },
    );
  }

  /** عدد الصفوف المطابقة للبحث الحالي. */
  async countRows(
    columns: string[],
    search?: string,
    table = TABLE_NAME,
    signal?: AbortSignal,
  ): Promise<number> {
    const rows = await this.runSelect(
      `SELECT count(*)::BIGINT AS n FROM ${quoteIdent(table)}${this.buildWhere(columns, search)}`,
      { limit: 1, signal },
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
    this.registeredSources = {};
    this.activeSourceAlias = null;
    this.activeSourceRevision += 1;
    this.activeRelationRevision += 1;
    clearCleaningExecutionAttestation();
    this.worker = null;
    this.workerUrl = null;
    this.initPromise = null;
  }
}

export const duckdb = new DuckDBService();
