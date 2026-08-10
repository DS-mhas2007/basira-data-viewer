/**
 * تنفيذ أدوات الوكيل داخل المتصفح: كل شيء يعمل محلياً على DuckDB.
 *
 * التعديل المهم:
 * - currentDataset لم تعد تعتمد فقط على الجدول الافتراضي dataset.
 * - إذا لم يوجد dataset، يتم البحث عن أي مصدر مسجّل في DuckDB واستخدامه.
 * - يتم أيضاً محاولة إنشاء VIEW افتراضي باسم dataset يشير إلى المصدر الحالي
 *   حتى تعمل الأدوات التي تكتب FROM dataset بدون كسر.
 */
import { duckdb, TABLE_NAME, type TableInfo } from "@/lib/duckdb-service";
import { runValidatedQuery, schemaFromTableInfo } from "@/lib/sql-validator";
import { applySteps, makeDedupeStep, makeTrimStep } from "@/lib/cleaning";
import { loadBoard, saveBoard, createWidget } from "@/lib/dashboard-board";
import type { Row } from "@/lib/parse-file";
import type { DatasetContext } from "@/lib/agent-chat";

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
 * إذا لم يكن الجدول الافتراضي dataset موجوداً،
 * نحاول إنشاء VIEW افتراضي يشير إلى المصدر الحالي.
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
    await duckdb.setRelation(
      `SELECT * FROM ${quoteIdent(source.table)}`,
      TABLE_NAME
    );

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
    await duckdb.setRelation(
      `SELECT * FROM ${quoteIdent(source.table)}`,
      TABLE_NAME
    );

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

  return {
    ok: true,
    message_ar: `تم تنفيذ الاستعلام محلياً وأعاد ${rows.length} صفاً.`,
    rows: preview,
    columns: preview[0] ? Object.keys(preview[0]) : [],
    sql: result.sanitizedQuery ?? input.sql,
  };
}

export async function execAddChart(input: {
  title: string;
  kind: "bar" | "line" | "area" | "pie";
  x: string;
  y: string;
  agg: "SUM" | "AVG" | "COUNT" | "MAX" | "MIN";
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

  const widget = createWidget(table, {
    kind: input.kind,
    x: input.x,
    y: input.y,
    agg: input.agg,
    title: input.title,
  });

  const board = loadBoard(AGENT_BOARD_KEY);

  saveBoard(AGENT_BOARD_KEY, {
    widgets: [...board.widgets, widget],
  });

  window.dispatchEvent(new CustomEvent("basira:board-updated"));

  return {
    ok: true,
    message_ar: `تمت إضافة الرسم «${input.title}» إلى لوحة الوكيل.`,
  };
}

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
