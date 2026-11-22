/**
 * تنفيذ أدوات الوكيل داخل المتصفح: كل شيء يعمل محلياً على DuckDB.
 *
 * ✅ التعديل: استخدام duckdb.query لإنشاء VIEW dataset بدلاً من setRelation
 * (مع الحفاظ على التوافق مع duckdb-service الجديد الذي يحتوي على query)
 */
import { duckdb, TABLE_NAME, type TableInfo } from "@/lib/duckdb-service";
import { MAX_LIMIT, runValidatedQuery, schemaFromTableInfo } from "@/lib/sql-validator";
import {
  applySteps,
  BASE_RELATION,
  buildRelation,
  countDuplicates,
  getActiveCleanSteps,
  makeDedupeStep,
  makeTrimStep,
  setActiveCleanSteps,
} from "@/lib/cleaning";
import { loadBoard, saveBoard, createWidget, getActiveBoardKey } from "@/lib/dashboard-board";
import type { Row } from "@/lib/parse-file";
import type { DatasetContext } from "@/lib/agent-chat";
import type { AiQueryResponse } from "@/lib/ai-query.functions";
import type { HealthReport } from "@/lib/data-health";
import { addDateCastQuality, buildWarnings, countBaseRows, extractFilters, getSourceColumnQuality, pickHighlights } from "@/lib/evidence";
import {
  buildSql,
  CHART_ROW_CAP,
  detectDateFormat,
  isTemporalColumn,
  normalizeChartRows,
  safeDateFormat,
  validateChartPoints,
  type ChartConfig,
} from "@/lib/chart-studio";
import { isNumericType } from "@/lib/profile";
import { detectOutliers, formatBound } from "@/lib/outliers";
import { buildMetricLineage } from "@/lib/metric-lineage";
import { summarizeDuckDbExplain } from "@/lib/duckdb-plan";
import { assessMetricAlignmentFromLineage, validateMetricDefinition, normalizeMetricFormula, computeMetricSchemaFingerprint, compareMetricSchemaFingerprint } from "@/lib/metric-definition-registry";
import { loadProjectMetricDefinitions } from "@/lib/workspace-store";
import { buildResultGrainProbeSql, canVerifyResultGrain, containsVolatileSqlExpression, interpretResultGrainProbe } from "@/lib/metric-result-grain";
import { buildCompositeKeyProfileSql, buildGrainProbeSql, buildKeyProfileSql, grainHintsByColumn, inferStructuralCompositeKeyCandidates, inferStructuralKeyCandidates, interpretGrainProbeRows, selectGrainCandidates, type GrainCompositeProfileRow, type GrainFinding, type GrainKeyProfileRow, type GrainProbeRow } from "@/lib/grain-detector";

export const AGENT_BOARD_KEY = "agent.chat";

const ACTIVE_ALIAS_STORAGE_KEY = "basira.agent.active-alias";

function quoteIdent(name: string) {
  return `"${name.replace(/"/g, '""')}"`;
}

function getPreferredAlias(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(ACTIVE_ALIAS_STORAGE_KEY);
  } catch {
    return null;
  }
}

function setPreferredAlias(alias: string | null) {
  if (typeof window === "undefined") return;

  try {
    if (alias) {
      window.localStorage.setItem(ACTIVE_ALIAS_STORAGE_KEY, alias);
    } else {
      window.localStorage.removeItem(ACTIVE_ALIAS_STORAGE_KEY);
    }
  } catch {
    /* تجاهل */
  }
}

/**
 * عندما يتم رفع ملف جديد أو تغيير المصدر النشط،
 * نحفظ الـ alias حتى نفضّله لاحقاً عند البحث عن البيانات.
 */
if (typeof window !== "undefined") {
  window.addEventListener(
    "basira:dataset-changed",
    ((event: CustomEvent<{ alias?: string }>) => {
      const alias = event.detail?.alias ?? null;
      setPreferredAlias(alias);
    }) as EventListener
  );
}

async function tryDescribe(table: string): Promise<TableInfo | null> {
  try {
    const info = await duckdb.describe(table);

    if (info && info.schema.length > 0) {
      return info;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * اختيار المصدر الحالي:
 * 1. نفضّل المصدر المخزّن في localStorage إذا كان موجوداً.
 * 2. وإلا نأخذ أول مصدر مسجّل في DuckDB.
 */
async function chooseSourceTable(): Promise<{ alias: string; table: string } | null> {
  try {
    const sources = await duckdb.listSources();

    if (!sources.length) {
      return null;
    }

    const preferredAlias = getPreferredAlias();

    const preferred = preferredAlias
      ? sources.find((s) => s.alias === preferredAlias)
      : undefined;

    const chosen = preferred ?? sources[0];

    if (!chosen) {
      return null;
    }

    return {
      alias: chosen.alias,
      table: chosen.table,
    };
  } catch {
    return null;
  }
}

/**
 * ✅ إذا لم يكن الجدول الافتراضي dataset موجوداً،
 * نحاول إنشاء VIEW حقيقي في DuckDB يشير إلى المصدر الحالي.
 *
 * مثال:
 * CREATE OR REPLACE VIEW dataset AS
 * SELECT * FROM "dataset__source__alias";
 */
async function ensureDefaultDatasetView(): Promise<void> {
  const defaultInfo = await tryDescribe(TABLE_NAME);

  if (defaultInfo) {
    return;
  }

  const source = await chooseSourceTable();

  if (!source) {
    return;
  }

  try {
    // ✅ استخدام duckdb.query لإنشاء VIEW حقيقي
    const safeTable = source.table.replace(/"/g, '""');
    await duckdb.query(`CREATE OR REPLACE VIEW ${TABLE_NAME} AS SELECT * FROM "${safeTable}"`);

    setPreferredAlias(source.alias);
  } catch {
    /* تجاهل */
  }
}

/**
 * يرجع معلومات الجدول النشط:
 * - يبدأ بمحاولة إصلاح/إنشاء dataset الافتراضي.
 * - إذا فشل، يستخدم أي مصدر مسجّل مباشرة.
 */
async function activeTableInfo(): Promise<TableInfo | null> {
  // أولاً: حاول إنشاء/إصلاح العرض الافتراضي dataset
  await ensureDefaultDatasetView();

  // ثانياً: جرّب الجدول الافتراضي dataset
  const defaultInfo = await tryDescribe(TABLE_NAME);

  if (defaultInfo) {
    return defaultInfo;
  }

  // ثالثاً: إذا لم يوجد dataset، جرّب أي مصدر مسجّل
  const source = await chooseSourceTable();

  if (!source) {
    return null;
  }

  const sourceInfo = await tryDescribe(source.table);

  if (!sourceInfo) {
    return null;
  }

  // محاولة أخيرة لجعل المصدر الحالي هو dataset الافتراضي
  try {
    const safeTable = source.table.replace(/"/g, '""');
    await duckdb.query(`CREATE OR REPLACE VIEW ${TABLE_NAME} AS SELECT * FROM "${safeTable}"`);

    const retryDefault = await tryDescribe(TABLE_NAME);

    if (retryDefault) {
      return retryDefault;
    }
  } catch {
    /* نكمل على المصدر مباشرة */
  }

  return sourceInfo;
}

const columnHintCache = new Map<string, Record<string, string>>();

/**
 * تلميحات عن الأعمدة تُرسل مع السياق: التواريخ المخزّنة كنص (صيغتها ومداها)
 * ومدى الأعمدة الزمنية، حتى لا يخمّن النموذج صيغة التاريخ.
 */
async function computeColumnHints(info: TableInfo): Promise<Record<string, string>> {
  const stepsKey = getActiveCleanSteps().map((s) => s.id).join(",");
  const cacheKey = `${info.table}|${info.rowCount}|${stepsKey}|${info.schema.map((c) => c.name + c.type).join(",")}`;
  const cached = columnHintCache.get(cacheKey);
  if (cached) return cached;

  const hints: Record<string, string> = {};
  const missing: Record<string, string> = {};
  const schema = schemaFromTableInfo(info);
  const t = quoteIdent(info.table);
  let budget = 12;

  for (const col of info.schema) {
    if (budget <= 0) break;
    const q = quoteIdent(col.name);
    try {
      if (isTemporalColumn(info, col.name)) {
        budget--;
        const r = await runValidatedQuery(
          `SELECT CAST(min(CAST(${q} AS DATE)) AS VARCHAR) AS lo, CAST(max(CAST(${q} AS DATE)) AS VARCHAR) AS hi FROM ${t}`,
          schema,
        );
        const row = r.rows?.[0];
        if (row?.["lo"] && row["hi"]) hints[col.name] = `نطاق التواريخ من ${row["lo"]} إلى ${row["hi"]}`;
      } else if (/VARCHAR|TEXT|STRING/i.test(col.type)) {
        budget--;
        const sample = await runValidatedQuery(
          `SELECT DISTINCT CAST(${q} AS VARCHAR) AS v FROM ${t} WHERE ${q} IS NOT NULL LIMIT 60`,
          schema,
        );
        const guess = detectDateFormat((sample.rows ?? []).map((r) => String(r["v"] ?? "")));
        const fmt = guess ? safeDateFormat(guess.format) : null;
        if (guess && fmt) {
          const d = `TRY_STRPTIME(CAST(${q} AS VARCHAR), '${fmt}')`;
          const range = await runValidatedQuery(
            `SELECT CAST(min(CAST(${d} AS DATE)) AS VARCHAR) AS lo, CAST(max(CAST(${d} AS DATE)) AS VARCHAR) AS hi FROM ${t}`,
            schema,
          );
          const row = range.rows?.[0];
          const span = row?.["lo"] && row["hi"] ? `، النطاق ${row["lo"]} إلى ${row["hi"]}` : "";
          hints[col.name] =
            `نص يمثل تاريخاً بصيغة '${fmt}'${guess.ambiguous ? " (يوم/شهر ملتبس)" : ""}${span}؛ حوّله بـ TRY_STRPTIME قبل أي تجميع زمني`;
        }
      }
    } catch {
      /* التلميح اختياري */
    }
  }
  // المفقودات (NULL أو نص فارغ) لكل عمود في استعلام واحد.
  try {
    const cols = info.schema.slice(0, 80);
    const selects = cols.map(
      (c, i) =>
        `sum(CASE WHEN ${quoteIdent(c.name)} IS NULL OR trim(CAST(${quoteIdent(c.name)} AS VARCHAR)) = '' THEN 1 ELSE 0 END)::BIGINT AS m${i}`,
    );
    const r = await runValidatedQuery(`SELECT ${selects.join(", ")} FROM ${t}`, schema);
    const row = r.rows?.[0];
    if (row && info.rowCount > 0) {
      cols.forEach((c, i) => {
        const n = Number(row[`m${i}`] ?? 0);
        if (n > 0) {
          const pct = Math.round((n / info.rowCount) * 1000) / 10;
          missing[c.name] = `مفقودة ${n.toLocaleString("en-US")} من ${info.rowCount.toLocaleString("en-US")} (${pct}%)`;
        }
      });
    }
  } catch {
    /* اختياري */
  }

  // القيم الشاذة (IQR) في الأعمدة الرقمية.
  const outlierHints: Record<string, string> = {};
  try {
    const numeric = info.schema.filter((c) => isNumericType(c.type)).map((c) => c.name);
    const found = await detectOutliers(`SELECT * FROM ${t}`, numeric);
    for (const o of found) {
      if (o.ratio < 0.005) continue;
      outlierHints[o.column] = `قيم شاذة ${o.count.toLocaleString("en-US")} (${(o.ratio * 100).toFixed(1)}%) خارج [${formatBound(o.lower)} ، ${formatBound(o.upper)}] بقاعدة IQR`;
    }
  } catch {
    /* اختياري */
  }

  const merged: Record<string, string> = {};
  for (const col of info.schema) {
    const parts = [hints[col.name], missing[col.name], outlierHints[col.name]].filter(Boolean);
    if (parts.length > 0) merged[col.name] = parts.join(" · ").slice(0, 200);
  }
  columnHintCache.set(cacheKey, merged);
  return merged;
}


const grainFindingCache = new Map<string, Promise<GrainFinding[]>>();

if (typeof window !== "undefined") {
  window.addEventListener("basira:dataset-changed", () => grainFindingCache.clear());
}

async function detectActiveDatasetGrain(info: TableInfo): Promise<GrainFinding[]> {
  const cacheKey = [
    info.table, info.rowCount,
    ...info.schema.map((column) => column.name + ":" + column.type),
    getActiveCleanSteps().map((step) => step.id).join(","),
  ].join("|");
  const cached = grainFindingCache.get(cacheKey);
  if (cached) return cached;
  const pending = (async () => {
    try {
      const registry = schemaFromTableInfo(info);
      const profileSql = buildKeyProfileSql(info.table, info.schema);
      let inferredKeys: string[] = [];
      if (profileSql) {
        const profile = await runValidatedQuery(profileSql, registry);
        if (profile.result.isValid && profile.rows) {
          inferredKeys = inferStructuralKeyCandidates(profile.rows as unknown as GrainKeyProfileRow[], info.rowCount);
        }
      }
      const candidates = selectGrainCandidates(info.schema, inferredKeys).keys.map((column) => column.name);
      const compositeSql = buildCompositeKeyProfileSql(info.table, info.schema, candidates);
      let compositeKeys: string[][] = [];
      if (compositeSql) {
        const profile = await runValidatedQuery(compositeSql, registry);
        if (profile.result.isValid && profile.rows) {
          compositeKeys = inferStructuralCompositeKeyCandidates(profile.rows as unknown as GrainCompositeProfileRow[], info.rowCount);
        }
      }
      const probeSql = buildGrainProbeSql(info.table, info.schema, inferredKeys, compositeKeys);
      if (!probeSql) return [];
      const execution = await runValidatedQuery(probeSql, registry);
      if (!execution.result.isValid || !execution.rows) return [];
      return interpretGrainProbeRows(execution.rows as unknown as GrainProbeRow[]);
    } catch {
      // Advisory diagnostics must never block ordinary analysis.
      return [];
    }
  })();
  grainFindingCache.set(cacheKey, pending);
  if (grainFindingCache.size > 20) {
    const oldest = grainFindingCache.keys().next().value;
    if (oldest) grainFindingCache.delete(oldest);
  }
  return pending;
}

export async function currentDataset(): Promise<DatasetContext | null> {
  const info = await activeTableInfo();

  if (!info || info.schema.length === 0) {
    return null;
  }

  // Keep DuckDB operations sequential on its shared connection.
  const hints = await computeColumnHints(info).catch(() => ({}) as Record<string, string>);
  const grainFindings = await detectActiveDatasetGrain(info);
  const grainHints = grainHintsByColumn(grainFindings);

  return {
    table: info.table,
    rowCount: info.rowCount,
    schema: info.schema.map((c) => ({
      name: c.name,
      type: c.type,
      ...([hints[c.name], grainHints[c.name]].filter(Boolean).length ? { hint: [hints[c.name], grainHints[c.name]].filter(Boolean).join(" · ").slice(0, 200) } : {}),
    })),
    fileName: getPreferredAlias() ?? null,
    cleaningSteps: getActiveCleanSteps().map((s) => s.label),
  };
}

export interface ToolOutput {
  ok: boolean;
  message_ar: string;
  rows?: Row[];
  columns?: string[];
  sql?: string;
  extra?: Record<string, unknown>;
}

/** A registry match is emitted only after full-result uniqueness is checked in DuckDB. */
async function buildProjectMetricAlignments(
  projectId: string | null | undefined,
  activeDatasetAlias: string | null | undefined,
  sql: string,
  rows: Row[],
  lineage: ReturnType<typeof buildMetricLineage>,
  schema: TableInfo,
): Promise<Array<{ definitionId: string; name: string; status: "aligned" | "mismatch" | "insufficient-evidence"; reasons: string[] }>> {
  if (!projectId || !projectId.trim()) return [];
  const definitions = await loadProjectMetricDefinitions(projectId);
  if (!definitions?.length) return [];

  const activeDataset = activeDatasetAlias;
  const results: Array<{ definitionId: string; name: string; status: "aligned" | "mismatch" | "insufficient-evidence"; reasons: string[] }> = [];
  for (const definition of definitions.filter((item) => item.status === "approved")) {
    const overlaps = definition.sourceColumns.some((column) =>
      lineage.sourceColumns.some((source) => source.toLowerCase() === column.toLowerCase()),
    );
    const expressionMatches = lineage.outputColumns.some((column) =>
      normalizeMetricFormula(column.expression) === normalizeMetricFormula(definition.formula),
    );
    if (!overlaps && !expressionMatches) continue;

    if (!activeDataset || definition.source.dataset.trim().toLowerCase() !== activeDataset.trim().toLowerCase()) {
      results.push({
        definitionId: definition.id,
        name: definition.name,
        status: "insufficient-evidence",
        reasons: [!activeDataset
          ? "لم تتوفر هوية موثوقة لمصدر البيانات النشط."
          : "مصدر البيانات النشط لا يطابق مجموعة البيانات المسجلة في تعريف المقياس."],
      });
      continue;
    }

    const activeSchemaFingerprint = computeMetricSchemaFingerprint({ columns: schema.schema });
    const schemaCheck = compareMetricSchemaFingerprint(definition.source.schemaFingerprint, activeSchemaFingerprint);
    if (schemaCheck.status !== "aligned") {
      results.push({
        definitionId: definition.id,
        name: definition.name,
        status: schemaCheck.status,
        reasons: [schemaCheck.reason],
      });
      continue;
    }

    const validation = validateMetricDefinition(definition, { columns: schema.schema });
    if (!validation.valid) {
      results.push({
        definitionId: definition.id,
        name: definition.name,
        status: "insufficient-evidence",
        reasons: validation.issues.map((issue) => issue.message).slice(0, 4),
      });
      continue;
    }
    const grainOutputs = definition.grain.map((grainName) =>
      lineage.outputColumns.find((column) =>
        column.outputName.toLowerCase() === grainName.toLowerCase() &&
        column.role === "dimension" &&
        column.confidence === "high",
      ),
    );
    let verifiedGrain: string[] | undefined;
    const hasExplicitLimit = lineage.operations.some((operation) => operation.kind === "limit");
    const canProbeGrain = canVerifyResultGrain({
      lineageStatus: lineage.status,
      hasExplicitLimit,
      returnedRows: rows.length,
      maxRows: MAX_LIMIT,
      grainColumns: definition.grain,
      hasVolatileExpressions: containsVolatileSqlExpression(sql),
    });
    const probeSql = canProbeGrain && grainOutputs.every(Boolean)
      ? buildResultGrainProbeSql(sql, definition.grain)
      : null;
    if (probeSql) {
      try {
        // DuckDB checks uniqueness across the complete non-truncated SELECT result.
        const probe = await duckdb.runSelect(probeSql, { limit: 2 });
        if (interpretResultGrainProbe(probe[0] as { group_count?: unknown; duplicate_groups?: unknown } | undefined)) {
          verifiedGrain = definition.grain;
        }
      } catch {
        // Grain verification is a hard prerequisite for "aligned", but a failed
        // probe must never fail the user's successful analysis.
      }
    }

    const alignment = assessMetricAlignmentFromLineage(definition, lineage, verifiedGrain);
    results.push({
      definitionId: definition.id,
      name: definition.name,
      status: alignment.status,
      reasons: alignment.reasons,
    });
  }
  return results.slice(0, 5);
}

/**
 * معلومات الجدول الحالية لجميع الأدوات.
 * الآن لا تعتمد فقط على describe() الافتراضي،
 * بل تبحث عن أي مصدر مسجّل إذا لزم.
 */
async function info(): Promise<TableInfo | null> {
  return activeTableInfo();
}

/** فحوص سريعة لنتيجة استعلام: فراغ، أعمدة كلها NULL، بلوغ سقف الصفوف، تواريخ متكررة بلا تجميع. */
export function sqlResultWarnings(rows: Row[]): string[] {
  return sqlResultIssues(rows).map((i) => i.text);
}

export interface SqlIssue {
  text: string;
  /** مشكلة تستحق إعادة محاولة تصحيح الاستعلام. */
  retryable: boolean;
}

export function sqlResultIssues(rows: Row[]): SqlIssue[] {
  const warnings: SqlIssue[] = [];
  if (rows.length === 0) {
    return [{ text: "النتيجة فارغة؛ راجع شروط التصفية أو تحويل التاريخ.", retryable: false }];
  }
  if (rows.length >= MAX_LIMIT) {
    warnings.push({
      text: `بلغت النتيجة سقف ${MAX_LIMIT} صف وقد تكون مقتطعة؛ أضف تجميعاً أو تصفية.`,
      retryable: false,
    });
  }
  const columns = Object.keys(rows[0] ?? {});
  for (const col of columns) {
    if (rows.every((r) => r[col] === null || r[col] === undefined)) {
      warnings.push({
        text: `العمود «${col}» كله NULL (غالباً فشل تحويل أو دالة خاطئة).`,
        retryable: true,
      });
    }
  }
  // عمود يبدو تاريخاً وتتكرر قيمته: معاملات متعددة لم تُجمَّع.
  for (const col of columns) {
    const vals = rows.map((r) => r[col]);
    const looksDate = vals.every((v) => typeof v === "string" && /^\d{4}-\d{2}(-\d{2})?/.test(v));
    if (looksDate && rows.length > 1 && new Set(vals).size < rows.length) {
      warnings.push({
        text: `قيم «${col}» الزمنية متكررة؛ يلزم GROUP BY على الفترة قبل الرسم.`,
        retryable: true,
      });
    }
  }
  return warnings;
}

export async function execRunSql(input: {
  sql: string;
  purpose_ar: string;
}, projectId?: string | null, activeDatasetAlias?: string | null): Promise<ToolOutput> {
  const table = await info();

  if (!table) {
    return {
      ok: false,
      message_ar: "لا توجد بيانات محمّلة في المتصفح.",
    };
  }

  const { result, rows } = await runValidatedQuery(
    input.sql,
    schemaFromTableInfo(table)
  );

  if (!result.isValid || !rows) {
    return {
      ok: false,
      message_ar: `الاستعلام مرفوض: ${result.rejectionReason ?? "غير صالح"}`,
      sql: input.sql,
    };
  }

  const preview = rows.slice(0, 30);
  const warnings = sqlResultWarnings(rows);
  const executedSql = result.sanitizedQuery ?? input.sql;
  let executionPlan = undefined;
  try {
    executionPlan = summarizeDuckDbExplain(await duckdb.explainSelect(executedSql)) ?? undefined;
  } catch {
    // EXPLAIN is optional and must never block a successful SQL result.
  }
  const lineage = buildMetricLineage(executedSql, {
    table: table.table,
    columns: table.schema,
  }, getActiveCleanSteps(), executionPlan);
  const metricAlignments = await buildProjectMetricAlignments(projectId, activeDatasetAlias, executedSql, rows, lineage, table);

  return {
    ok: true,
    message_ar:
      `تم تنفيذ الاستعلام محلياً وأعاد ${rows.length} صفاً.` +
      (warnings.length > 0 ? ` تنبيه: ${warnings.join(" ")}` : ""),
    rows: preview,
    columns: preview[0] ? Object.keys(preview[0]) : [],
    sql: executedSql,
    extra: { warnings, evidence: { lineage, metricAlignments } },
  };
}

export async function execAddChart(input: {
  title: string;
  kind: "bar" | "line" | "area" | "pie";
  x: string;
  y: string;
  agg: "SUM" | "AVG" | "COUNT" | "MAX" | "MIN";
  bucket?: "auto" | "day" | "week" | "month" | "year" | "none";
}): Promise<ToolOutput> {
  const table = await info();

  if (!table) {
    return {
      ok: false,
      message_ar: "لا توجد بيانات محمّلة.",
    };
  }

  const names = table.schema.map((c) => c.name);

  if (!names.includes(input.x) || !names.includes(input.y)) {
    return {
      ok: false,
      message_ar: "أحد الأعمدة المطلوبة غير موجود في الملف.",
    };
  }

  const yType = table.schema.find((c) => c.name === input.y)?.type ?? "";
  if (input.agg !== "COUNT" && !isNumericType(yType)) {
    return {
      ok: false,
      message_ar: `العمود «${input.y}» نصي (${yType}) ولا يصلح للتجميع بـ ${input.agg}. استخدم COUNT أو اختر عموداً رقمياً.`,
    };
  }

  const schema = schemaFromTableInfo(table);
  const warnings: string[] = [];
  const patch: Partial<ChartConfig> = {
    kind: input.kind,
    x: input.x,
    y: input.y,
    agg: input.agg,
    title: input.title,
  };

  // تواريخ مخزنة كنص: نكتشف الصيغة من عينة قيم بدل أن يخمّن النموذج.
  let temporal = isTemporalColumn(table, input.x);
  if (!temporal && /VARCHAR|TEXT|STRING/i.test(table.schema.find((c) => c.name === input.x)?.type ?? "")) {
    try {
      const sample = await runValidatedQuery(
        `SELECT DISTINCT CAST(${quoteIdent(input.x)} AS VARCHAR) AS v FROM ${quoteIdent(table.table)} WHERE ${quoteIdent(input.x)} IS NOT NULL LIMIT 200`,
        schema,
      );
      const guess = detectDateFormat((sample.rows ?? []).map((r) => String(r["v"] ?? "")));
      if (guess) {
        patch.dateFormat = guess.format;
        temporal = true;
        if (guess.ambiguous) {
          warnings.push("صيغة التاريخ التبست بين شهر/يوم ويوم/شهر؛ فُسّرت على أنها شهر/يوم/سنة.");
        }
      }
    } catch {
      /* نكمل بدون اكتشاف التاريخ */
    }
  }

  const wantsBucket = input.bucket !== "none";
  if (temporal && wantsBucket) {
    // عدة معاملات في اليوم نفسه تُجمَّع في فترة واحدة بدل نقطة لكل طابع زمني.
    patch.bucket = input.bucket && input.bucket !== "none" ? input.bucket : "auto";
    patch.sort = "label_asc";
    patch.limit = CHART_ROW_CAP;
  } else if (input.kind === "line" || input.kind === "area") {
    patch.sort = "label_asc";
    patch.limit = CHART_ROW_CAP;
  }

  const widget = createWidget(table, patch);

  // تحقّق من أن الرسم ينتج بيانات منطقية قبل حفظه في اللوحة.
  let preview: { sql: string; points: { label: string; value: number }[] } | null = null;
  try {
    const sql = buildSql(table, widget.config);
    const execution = await runValidatedQuery(sql, schema);
    if (execution.result.isValid && execution.rows) {
      const normalized = normalizeChartRows(execution.rows);
      preview = {
        sql: execution.result.sanitizedQuery ?? sql,
        points: normalized.points.map((p) => ({ label: p.label, value: p.value })),
      };
      if (normalized.omitted > 0) warnings.push(`استُبعدت ${normalized.omitted} نقطة بقيم غير صالحة.`);
    }
  } catch {
    preview = null;
  }

  if (!preview) {
    return {
      ok: false,
      message_ar:
        "لم يُضف الرسم لأن الاستعلام فشل. تحقق من العمودين (وصيغة التاريخ إن كان نصاً) ثم أعد المحاولة.",
    };
  }

  const check = validateChartPoints(preview.points, { temporal, kind: input.kind });
  if (!check.ok) {
    return {
      ok: false,
      message_ar: `لم يُضف الرسم: ${check.problems.join(" ")}`,
      sql: preview.sql,
    };
  }

  if (widget.config.limit > 0 && preview.points.length >= widget.config.limit) {
    warnings.push(
      temporal
        ? `بلغ الرسم سقف ${widget.config.limit} نقطة؛ جرّب تجميعاً أوسع (شهري/سنوي).`
        : `يعرض الرسم أعلى ${widget.config.limit} فئة فقط.`,
    );
  }

  const boardKey = getActiveBoardKey() ?? AGENT_BOARD_KEY;
  const board = loadBoard(boardKey);
  saveBoard(boardKey, { widgets: [...board.widgets, widget] });
  window.dispatchEvent(new CustomEvent("basira:board-updated", { detail: { boardKey } }));

  const bucketNote =
    temporal && patch.bucket ? ` (مجمَّعة ${BUCKET_AR[patch.bucket] ?? "تلقائياً"})` : "";
  const message_ar =
    `تمت إضافة الرسم «${input.title}» إلى لوحة القيادة${bucketNote}.` +
    (warnings.length > 0 ? ` تنبيه: ${warnings.join(" ")}` : "");
  const extra: Record<string, unknown> = { dashboard_added: true };
  if (warnings.length > 0) extra["warnings"] = warnings;

  if (preview.points.length < 2) {
    return { ok: true, message_ar, extra };
  }
  return {
    ok: true,
    message_ar,
    rows: preview.points,
    columns: ["label", "value"],
    sql: preview.sql,
    extra: {
      ...extra,
      title_ar: input.title,
      chart: { type: input.kind, x: "label", y: ["value"], series: null },
    },
  };
}

const BUCKET_AR: Record<string, string> = {
  auto: "تلقائياً",
  day: "يومياً",
  week: "أسبوعياً",
  month: "شهرياً",
  year: "سنوياً",
};

export async function execClean(input: {
  operation: "dedupe" | "trim";
  reason_ar: string;
}): Promise<ToolOutput> {
  const table = await info();

  if (!table) {
    return {
      ok: false,
      message_ar: "لا توجد بيانات محمّلة.",
    };
  }

  const names = table.schema.map((c) => c.name);

  const textCols = table.schema
    .filter((c) => /char|text|string/i.test(c.type))
    .map((c) => c.name);

  // نبني فوق خطوات التنظيف الحالية (الملء، التحويل، الدمج…) بدل استبدالها.
  const existing = getActiveCleanSteps();
  let duplicates = 0;
  if (input.operation === "dedupe") {
    duplicates = await countDuplicates(buildRelation(existing) ?? BASE_RELATION).catch(() => 0);
  }
  const step =
    input.operation === "dedupe"
      ? makeDedupeStep(duplicates)
      : makeTrimStep(names, textCols, 0);

  const steps = [...existing, step];
  const after = await applySteps(steps);
  setActiveCleanSteps(steps);

  window.dispatchEvent(
    new CustomEvent("basira:clean-steps-changed", { detail: { steps, info: after } }),
  );

  return {
    ok: true,
    message_ar:
      input.operation === "dedupe"
        ? `تمت إزالة الصفوف المكرّرة — عدد الصفوف الآن ${after.rowCount}.`
        : `تم تشذيب المسافات في ${textCols.length} عمود نصي.`,
  };
}

export function execPinInsight(input: {
  title_ar: string;
  summary_ar: string;
}): ToolOutput {
  try {
    const raw = window.localStorage.getItem("basira.agent.insights");
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];

    list.push({
      ...input,
      at: Date.now(),
    });

    window.localStorage.setItem("basira.agent.insights", JSON.stringify(list));
  } catch {
    /* تجاهل */
  }

  return {
    ok: true,
    message_ar: `تم تثبيت الاستنتاج «${input.title_ar}».`,
  };
}

export function execReportOutline(input: {
  audience: string;
  sections_ar: string[];
  notes_ar: string;
}): ToolOutput {
  try {
    window.localStorage.setItem(
      "basira.agent.outline",
      JSON.stringify({
        ...input,
        at: Date.now(),
      })
    );
  } catch {
    /* تجاهل */
  }

  return {
    ok: true,
    message_ar: `تم إعداد هيكلية تقرير من ${input.sections_ar.length} قسم.`,
    extra: {
      sections: input.sections_ar,
    },
  };
}

type QuickPlanner = (options: {
  data: {
    question: string;
    table: string;
    rowCount: number;
    schema: { name: string; type: string }[];
    sample: Row[];
    retry: { sql: string; error: string } | null;
  };
}) => Promise<AiQueryResponse>;

/**
 * مسار التحليل السريع داخل المحادثة الموحدة:
 * يطلب خطة SQL مهيكلة، يتحقق منها عبر نفس SQL validator، ثم يعيد النتائج والدليل.
 * لا يُنفّذ أي SQL غير صالح، ولا يرسل ملف المستخدم الأصلي إلى النموذج.
 */
export async function execQuickAnalysis(
  input: { question: string },
  planner: QuickPlanner,
  health: HealthReport | null,
  projectId?: string | null,
  activeDatasetAlias?: string | null,
): Promise<ToolOutput> {
  const dataset = await currentDataset();
  if (!dataset) {
    return { ok: false, message_ar: "لا توجد بيانات محمّلة. ارفع ملفاً أولاً." };
  }

  const tableInfo: TableInfo = {
    table: dataset.table,
    rowCount: dataset.rowCount,
    schema: dataset.schema,
  };
  const registry = schemaFromTableInfo(tableInfo);
  const sampleResult = await runValidatedQuery(
    `SELECT * FROM ${quoteIdent(dataset.table)} LIMIT 8`,
    registry,
  );
  const sample = sampleResult.result.isValid ? (sampleResult.rows ?? []) : [];
  let retry: { sql: string; error: string } | null = null;
  let lastError = "تعذّر تنفيذ الاستعلام.";

  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await planner({
      data: {
        question: input.question,
        table: dataset.table,
        rowCount: dataset.rowCount,
        schema: dataset.schema,
        sample,
        retry,
      },
    });

    if (!response.ok) {
      return { ok: false, message_ar: response.error };
    }

    const plan = response.plan;
    if (plan.needs_clarification) {
      return {
        ok: true,
        message_ar: plan.clarification_question ?? "أحتاج إلى توضيح بسيط قبل التحليل.",
        extra: { needsClarification: true },
      };
    }

    const execution = await runValidatedQuery(plan.sql, registry);
    if (!execution.result.isValid || !execution.rows) {
      lastError = execution.result.rejectionReason ?? "رفض محرك SQL الاستعلام.";
      retry = { sql: plan.sql.slice(0, 4000), error: lastError.slice(0, 600) };
      continue;
    }

    const rows = execution.rows;
    const issues = sqlResultIssues(rows);
    const retryable = issues.filter((i) => i.retryable);
    if (attempt === 0 && retryable.length > 0) {
      lastError = retryable.map((i) => i.text).join(" ");
      retry = {
        sql: plan.sql.slice(0, 4000),
        error: `${lastError} صحّح الاستعلام: للتواريخ النصية استخدم TRY_STRPTIME بالصيغة المذكورة بجانب العمود، وجمّع المعاملات المتعددة بـ GROUP BY على الفترة.`.slice(0, 600),
      };
      continue;
    }
    const sql = execution.result.sanitizedQuery ?? plan.sql;
    const baseRowCount = await countBaseRows(sql, registry);
    const sourceColumns = await addDateCastQuality(
      sql,
      getSourceColumnQuality(sql, health),
      registry,
    );
    const warnings = [
      ...issues.map((i) => i.text),
      ...buildWarnings(
        plan,
        health,
        [...(rows[0] ? Object.keys(rows[0]) : []), ...sourceColumns.map((column) => column.name)],
      ),
    ].slice(0, 6);
    let executionPlan = undefined;
    try {
      executionPlan = summarizeDuckDbExplain(await duckdb.explainSelect(sql)) ?? undefined;
    } catch {
      // EXPLAIN is optional and must never block a successful analysis.
    }
    const lineage = buildMetricLineage(sql, {
      table: tableInfo.table,
      columns: tableInfo.schema,
    }, getActiveCleanSteps(), executionPlan);
    const metricAlignments = await buildProjectMetricAlignments(projectId, activeDatasetAlias, sql, rows, lineage, tableInfo);
    const evidence = {
      filters: extractFilters(sql),
      baseRowCount,
      resultRowCount: rows.length,
      highlights: pickHighlights(plan, rows),
      sourceColumns,
      warnings,
      lineage,
      metricAlignments,
    };
    const message = [
      plan.title_ar,
      plan.intro_ar,
      plan.analysis_ar,
      warnings.length ? `تنبيهات مهمة:\\n${warnings.map((warning) => `- ${warning}`).join("\\n")}` : "",
      rows.length === 0 ? "لم يُرجع الاستعلام صفوفاً." : `عدد الصفوف الناتجة: ${rows.length.toLocaleString("en-US")}.`,
    ].filter(Boolean).join("\\n\\n");

    return {
      ok: true,
      message_ar: message,
      rows: rows.slice(0, 30),
      columns: rows[0] ? Object.keys(rows[0]) : [],
      sql,
      extra: {
        title_ar: plan.title_ar,
        intent: plan.intent,
        chart: plan.chart,
        evidence,
      },
    };
  }

  return {
    ok: false,
    message_ar: `تعذّر تنفيذ التحليل بأمان بعد محاولة تصحيح واحدة. ${lastError}`,
  };
}

