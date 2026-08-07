/**
 * تنفيذ أدوات الوكيل داخل المتصفح: كل شيء يعمل محلياً على DuckDB.
 */
import { duckdb, TABLE_NAME, type TableInfo } from "@/lib/duckdb-service";
import { runValidatedQuery, schemaFromTableInfo } from "@/lib/sql-validator";
import { applySteps, makeDedupeStep, makeTrimStep } from "@/lib/cleaning";
import { loadBoard, saveBoard, createWidget } from "@/lib/dashboard-board";
import type { Row } from "@/lib/parse-file";
import type { DatasetContext } from "@/lib/agent-chat";

export const AGENT_BOARD_KEY = "agent.chat";

export async function currentDataset(): Promise<DatasetContext | null> {
  try {
    const info = await duckdb.describe();
    if (!info || info.schema.length === 0) return null;
    return {
      table: TABLE_NAME,
      rowCount: info.rowCount,
      schema: info.schema.map((c) => ({ name: c.name, type: c.type })),
      fileName: null,
    };
  } catch {
    return null;
  }
}

export interface ToolOutput {
  ok: boolean;
  message_ar: string;
  rows?: Row[];
  columns?: string[];
  sql?: string;
  extra?: Record<string, unknown>;
}

async function info(): Promise<TableInfo | null> {
  try {
    return await duckdb.describe();
  } catch {
    return null;
  }
}

export async function execRunSql(input: { sql: string; purpose_ar: string }): Promise<ToolOutput> {
  const table = await info();
  if (!table) return { ok: false, message_ar: "لا توجد بيانات محمّلة في المتصفح." };
  const { result, rows } = await runValidatedQuery(input.sql, schemaFromTableInfo(table));
  if (!result.isValid || !rows) {
    return {
      ok: false,
      message_ar: `الاستعلام مرفوض: ${result.errors?.join(" / ") ?? "غير صالح"}`,
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
  if (!table) return { ok: false, message_ar: "لا توجد بيانات محمّلة." };
  const names = table.schema.map((c) => c.name);
  if (!names.includes(input.x) || !names.includes(input.y)) {
    return { ok: false, message_ar: "أحد الأعمدة المطلوبة غير موجود في الملف." };
  }
  const widget = createWidget(table, {
    kind: input.kind,
    x: input.x,
    y: input.y,
    agg: input.agg,
    title: input.title,
  });
  const board = loadBoard(AGENT_BOARD_KEY);
  saveBoard(AGENT_BOARD_KEY, { widgets: [...board.widgets, widget] });
  window.dispatchEvent(new CustomEvent("basira:board-updated"));
  return { ok: true, message_ar: `تمت إضافة الرسم «${input.title}» إلى لوحة الوكيل.` };
}

export async function execClean(input: {
  operation: "dedupe" | "trim";
  reason_ar: string;
}): Promise<ToolOutput> {
  const table = await info();
  if (!table) return { ok: false, message_ar: "لا توجد بيانات محمّلة." };
  const names = table.schema.map((c) => c.name);
  const textCols = table.schema.filter((c) => /char|text|string/i.test(c.type)).map((c) => c.name);
  const step =
    input.operation === "dedupe" ? makeDedupeStep(0) : makeTrimStep(names, textCols, 0);
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

export function execPinInsight(input: { title_ar: string; summary_ar: string }): ToolOutput {
  try {
    const raw = window.localStorage.getItem("basira.agent.insights");
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    list.push({ ...input, at: Date.now() });
    window.localStorage.setItem("basira.agent.insights", JSON.stringify(list));
  } catch {
    /* تجاهل */
  }
  return { ok: true, message_ar: `تم تثبيت الاستنتاج «${input.title_ar}».` };
}

export function execReportOutline(input: {
  audience: string;
  sections_ar: string[];
  notes_ar: string;
}): ToolOutput {
  try {
    window.localStorage.setItem("basira.agent.outline", JSON.stringify({ ...input, at: Date.now() }));
  } catch {
    /* تجاهل */
  }
  return {
    ok: true,
    message_ar: `تم إعداد هيكلية تقرير من ${input.sections_ar.length} قسم.`,
    extra: { sections: input.sections_ar },
  };
}
