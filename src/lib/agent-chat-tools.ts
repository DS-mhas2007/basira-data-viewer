/**
 * تنفيذ أدوات الوكيل داخل المتصفح: كل شيء يعمل محلياً على DuckDB.
 *
 * ✅ التعديل: استخدام duckdb.query لإنشاء VIEW dataset بدلاً من setRelation
 * (مع الحفاظ على التوافق مع duckdb-service الجديد الذي يحتوي على query)
 */
import { duckdb, TABLE_NAME, type TableInfo } from "@/lib/duckdb-service";
import { MAX_LIMIT, runValidatedQuery, schemaFromTableInfo } from "@/lib/sql-validator";
import { applySteps, makeDedupeStep, makeTrimStep } from "@/lib/cleaning";
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
  validateChartPoints,
  type ChartConfig,
} from "@/lib/chart-studio";
import { isNumericType } from "@/lib/profile";

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

export async function currentDataset(): Promise<DatasetContext | null> {
  const info = await activeTableInfo();

  if (!info || info.schema.length === 0) {
    return null;
  }

  return {
    table: info.table,
    rowCount: info.rowCount,
    schema: info.schema.map((c) => ({
      name: c.name,
      type: c.type,
    })),
    fileName: getPreferredAlias() ?? null,
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
  const warnings: string[] = [];
  if (rows.length === 0) {
    return ["النتيجة فارغة؛ راجع شروط التصفية أو تحويل التاريخ."];
  }
  if (rows.length >= MAX_LIMIT) {
    warnings.push(`بلغت النتيجة سقف ${MAX_LIMIT} صف وقد تكون مقتطعة؛ أضف تجميعاً أو تصفية.`);
  }
  const columns = Object.keys(rows[0] ?? {});
  for (const col of columns) {
    if (rows.every((r) => r[col] === null || r[col] === undefined)) {
      warnings.push(`العمود «${col}» كله NULL (غالباً فشل تحويل أو دالة خاطئة).`);
    }
  }
  // عمود يبدو تاريخاً وتتكرر قيمته: معاملات متعددة لم تُجمَّع.
  for (const col of columns) {
    const vals = rows.map((r) => r[col]);
    const looksDate = vals.every((v) => typeof v === "string" && /^\d{4}-\d{2}(-\d{2})?/.test(v));
    if (looksDate && rows.length > 1 && new Set(vals).size < rows.length) {
      warnings.push(`قيم «${col}» الزمنية متكررة؛ يلزم GROUP BY على الفترة قبل الرسم.`);
    }
  }
  return warnings;
}

export async function execRunSql(input: {
  sql: string;
  purpose_ar: string;
}): Promise<ToolOutput> {
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

  return {
    ok: true,
    message_ar:
      `تم تنفيذ الاستعلام محلياً وأعاد ${rows.length} صفاً.` +
      (warnings.length > 0 ? ` تنبيه: ${warnings.join(" ")}` : ""),
    rows: preview,
    columns: preview[0] ? Object.keys(preview[0]) : [],
    sql: result.sanitizedQuery ?? input.sql,
    ...(warnings.length > 0 ? { extra: { warnings } } : {}),
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

  const step =
    input.operation === "dedupe"
      ? makeDedupeStep(0)
      : makeTrimStep(names, textCols, 0);

  const after = await applySteps([step]);

  window.dispatchEvent(new CustomEvent("basira:data-changed"));

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
    const sql = execution.result.sanitizedQuery ?? plan.sql;
    const baseRowCount = await countBaseRows(sql, registry);
    const sourceColumns = await addDateCastQuality(
      sql,
      getSourceColumnQuality(sql, health),
      registry,
    );
    const warnings = buildWarnings(
      plan,
      health,
      [...(rows[0] ? Object.keys(rows[0]) : []), ...sourceColumns.map((column) => column.name)],
    ).slice(0, 6);
    const evidence = {
      filters: extractFilters(sql),
      baseRowCount,
      resultRowCount: rows.length,
      highlights: pickHighlights(plan, rows),
      sourceColumns,
      warnings,
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

