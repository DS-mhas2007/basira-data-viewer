/**
 * وكيل بصيرة الذكي (AI Agent): ينفّذ سلسلة التحليل الكاملة بنفسه
 * — فحص، تنظيف، كشف شذوذ، توصيف، مؤشرات قطاع، استنتاجات، تقرير وتوصيات —
 * كل الحسابات محلية عبر DuckDB، والذكاء الاصطناعي للصياغة والاستنتاج فقط.
 */
import {
  BASE_RELATION,
  applySteps,
  buildMagicRecipe,
  buildRelation,
  checkCastability,
  detectDateColumns,
  type CleanStep,
} from "@/lib/cleaning";
import { computeHealthReport, type HealthReport } from "@/lib/data-health";
import { detectAnomalies, type AnomalySignal } from "@/lib/anomaly-radar";
import { profileDataset, isDateColumn, isNumericType, type DatasetProfile } from "@/lib/profile";
import { runPlaybook, type PlaybookResult } from "@/lib/playbooks";
import { generateAutoInsights } from "@/lib/auto-insights";
import type { TableInfo } from "@/lib/duckdb-service";
import type { Row } from "@/lib/parse-file";
import type { PinnedInsight } from "@/lib/report";
import type { AiQueryResponse } from "@/lib/ai-query.functions";
import type { AgentBrief, AgentBriefResponse } from "@/lib/agent-brief.functions";

export type AgentStepId =
  | "scan"
  | "clean"
  | "anomalies"
  | "dashboard"
  | "sector"
  | "insights"
  | "brief";

export type AgentStepStatus = "pending" | "running" | "done" | "skipped" | "error";

export interface AgentStepState {
  id: AgentStepId;
  label: string;
  status: AgentStepStatus;
  detail?: string;
}

export const AGENT_STEPS: { id: AgentStepId; label: string }[] = [
  { id: "scan", label: "فحص جودة البيانات" },
  { id: "clean", label: "تنظيف البيانات تلقائياً" },
  { id: "anomalies", label: "كشف الأخطاء والقيم الشاذة" },
  { id: "dashboard", label: "بناء اللوحة البصرية" },
  { id: "sector", label: "استخراج مؤشرات القطاع" },
  { id: "insights", label: "توليد الاستنتاجات" },
  { id: "brief", label: "كتابة التقرير والتوصيات" },
];

export function initialAgentSteps(): AgentStepState[] {
  return AGENT_STEPS.map((s) => ({ ...s, status: "pending" as const }));
}

export interface AgentOutcome {
  tableInfo: TableInfo;
  cleanSteps: CleanStep[];
  health: HealthReport | null;
  signals: AnomalySignal[];
  profile: DatasetProfile | null;
  playbook: PlaybookResult | null;
  insights: PinnedInsight[];
  brief: AgentBrief | null;
  durationMs: number;
}

type AskFn = (opts: { data: unknown }) => Promise<AiQueryResponse>;
type BriefFn = (opts: { data: unknown }) => Promise<AgentBriefResponse>;

export interface RunAgentOptions {
  tableInfo: TableInfo;
  fileName: string;
  sample: Row[];
  cleanSteps: CleanStep[];
  askAi: AskFn;
  writeBrief: BriefFn;
  /** تعطيل خطوة التنظيف التلقائي إن رغب المستخدم. */
  autoClean?: boolean;
  onStep: (id: AgentStepId, status: AgentStepStatus, detail?: string) => void;
}

const nf = (n: number) => n.toLocaleString("en-US");

/** يشغّل خط الإنتاج الكامل خطوة بخطوة مع تحديث حيّ للحالة. */
export async function runAgent(opts: RunAgentOptions): Promise<AgentOutcome> {
  const started = performance.now();
  const { onStep, askAi, writeBrief } = opts;
  let tableInfo = opts.tableInfo;
  let cleanSteps = [...opts.cleanSteps];
  let health: HealthReport | null = null;
  let signals: AnomalySignal[] = [];
  let profile: DatasetProfile | null = null;
  let playbook: PlaybookResult | null = null;
  let insights: PinnedInsight[] = [];
  let brief: AgentBrief | null = null;

  /* 1) فحص الجودة */
  onStep("scan", "running");
  try {
    health = await computeHealthReport(tableInfo.schema, tableInfo.table);
    onStep("scan", "done", `الجودة ${health.score}/100 · ${nf(health.rowCount)} صف`);
  } catch {
    onStep("scan", "error", "تعذّر حساب مؤشر الجودة");
  }

  /* 2) التنظيف التلقائي */
  onStep("clean", "running");
  try {
    if (opts.autoClean === false) {
      onStep("clean", "skipped", "التنظيف التلقائي معطّل");
    } else {
      const relation = buildRelation(cleanSteps) ?? BASE_RELATION;
      const allColumns = tableInfo.schema.map((c) => c.name);
      const textColumns = tableInfo.schema
        .filter((c) => !isNumericType(c.type) && !/(DATE|TIMESTAMP|TIME)/i.test(c.type))
        .map((c) => c.name);
      const missing = (health?.columns ?? [])
        .filter((c) => c.nullCount > 0)
        .map((c) => ({ name: c.name, type: c.type, nullCount: c.nullCount }));

      const dates = await detectDateColumns(relation, textColumns).catch(() => []);
      const casts: { column: string; target: "DOUBLE" | "DATE"; failing: number }[] = [];
      for (const col of health?.columns ?? []) {
        if (col.isNumeric || col.typeMismatchCount === 0) continue;
        try {
          const c = await checkCastability(relation, col.name, "DOUBLE");
          if (c.ratio > 0.8 && c.failing > 0) {
            casts.push({ column: col.name, target: "DOUBLE", failing: c.failing });
          }
        } catch {
          /* تجاهل */
        }
      }

      const recipe = await buildMagicRecipe(relation, allColumns, textColumns, missing, {
        casts,
        dates,
      });
      if (recipe.steps.length === 0) {
        onStep("clean", "skipped", "البيانات نظيفة أصلاً");
      } else {
        cleanSteps = [...cleanSteps, ...recipe.steps];
        tableInfo = await applySteps(cleanSteps);
        health = await computeHealthReport(tableInfo.schema, tableInfo.table).catch(() => health);
        onStep(
          "clean",
          "done",
          `${recipe.steps.length} إصلاح · ${nf(recipe.cells)} قيمة مُعالَجة`,
        );
      }
    }
  } catch {
    onStep("clean", "error", "تعذّر تطبيق التنظيف التلقائي");
  }

  /* 3) كشف الشذوذ */
  onStep("anomalies", "running");
  try {
    signals = await detectAnomalies(tableInfo);
    onStep(
      "anomalies",
      "done",
      signals.length === 0 ? "لا إشارات مقلقة" : `${signals.length} إشارة تستحق المراجعة`,
    );
  } catch {
    onStep("anomalies", "error", "تعذّر تشغيل الرادار");
  }

  /* 4) اللوحة البصرية */
  onStep("dashboard", "running");
  try {
    profile = await profileDataset(tableInfo);
    onStep("dashboard", "done", `${profile.cards.length} مخطط جاهز`);
  } catch {
    onStep("dashboard", "error", "تعذّر بناء المخططات");
  }

  /* 5) مؤشرات القطاع */
  onStep("sector", "running");
  try {
    playbook = await runPlaybook(tableInfo);
    onStep("sector", "done", `${playbook.name} · ${playbook.kpis.length} مؤشر`);
  } catch {
    onStep("sector", "error", "تعذّر التعرّف على القطاع");
  }

  /* 6) الاستنتاجات */
  onStep("insights", "running");
  try {
    insights = await generateAutoInsights({
      askAi,
      tableInfo,
      sample: opts.sample,
      health,
    });
    if (insights.length === 0) onStep("insights", "skipped", "لم تُنتج استنتاجات صالحة");
    else onStep("insights", "done", `${insights.length} استنتاج مدعوم بالأدلة`);
  } catch {
    onStep("insights", "error", "تعذّر توليد الاستنتاجات");
  }

  /* 7) التقرير والتوصيات */
  onStep("brief", "running");
  try {
    const res = await writeBrief({
      data: {
        fileName: opts.fileName,
        rowCount: tableInfo.rowCount,
        columnCount: tableInfo.schema.length,
        sector: playbook?.name ?? "",
        healthScore: health?.score ?? null,
        cleaning: cleanSteps.map((s) => s.label).slice(0, 20),
        kpis: (playbook?.kpis ?? []).map((k) => ({ label: k.label, value: k.value })),
        signals: signals.map((s) => `${s.title}: ${s.detail}`).slice(0, 12),
        insights: insights
          .map((i) => `${i.plan.title_ar} — ${i.plan.analysis_ar || i.plan.intro_ar}`)
          .slice(0, 12),
        columns: tableInfo.schema.slice(0, 120).map((c) => ({
          name: c.name,
          type: isDateColumn(c.type, c.name) ? "تاريخ" : c.type,
        })),
      },
    });
    if (res.ok) {
      brief = res.brief;
      onStep("brief", "done", "التقرير التنفيذي جاهز");
    } else {
      onStep("brief", "error", res.error);
    }
  } catch {
    onStep("brief", "error", "تعذّر توليد التقرير");
  }

  return {
    tableInfo,
    cleanSteps,
    health,
    signals,
    profile,
    playbook,
    insights,
    brief,
    durationMs: performance.now() - started,
  };
}