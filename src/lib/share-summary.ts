/**
 * ملخص جاهز للصق في واتساب / سلاك / تيمز.
 * نص عادي بإيموجي — يُبنى محلياً من نتائج الوحدات 3/6/7/9.
 */
import type { HealthReport } from "@/lib/data-health";
import type { CleanStep } from "@/lib/cleaning";
import type { PinnedInsight } from "@/lib/report";
import type { AnomalySignal } from "@/lib/anomaly-radar";
import type { PlaybookResult } from "@/lib/playbooks";

export type ShareChannel = "whatsapp" | "slack";

export interface ShareInput {
  fileName: string;
  health: HealthReport | null;
  rowCount: number;
  columnCount: number;
  cleanSteps: CleanStep[];
  insights: PinnedInsight[];
  signals: AnomalySignal[];
  playbook?: PlaybookResult | null;
  date?: Date;
}

const AR_DATE = new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" });

function bullet(channel: ShareChannel, text: string) {
  return channel === "slack" ? `• ${text}` : `🔹 ${text}`;
}

function bold(channel: ShareChannel, text: string) {
  return channel === "slack" ? `*${text}*` : `*${text}*`;
}

export function buildShareSummary(input: ShareInput, channel: ShareChannel = "whatsapp"): string {
  const date = input.date ?? new Date();
  const title = input.fileName.replace(/\.(csv|xlsx|xls)$/i, "");
  const lines: string[] = [];

  lines.push(`📊 ${bold(channel, `ملخص تحليل: ${title}`)} — بصيرة`);
  lines.push(`🗓️ التاريخ: ${AR_DATE.format(date)}`);
  if (input.playbook && input.playbook.id !== "generic") {
    lines.push(`🏷️ ${input.playbook.name}`);
  }
  lines.push("");

  lines.push(
    bullet(channel, `حجم البيانات: ${input.rowCount.toLocaleString("en-US")} صف × ${input.columnCount} عمود`),
  );

  if (input.health) {
    const icon = input.health.score >= 90 ? "🟢" : input.health.score >= 60 ? "🟡" : "🔴";
    lines.push(bullet(channel, `جودة البيانات: ${input.health.score}/100 ${icon}`));
  }

  for (const kpi of input.playbook?.kpis.slice(0, 3) ?? []) {
    lines.push(bullet(channel, `${kpi.label}: ${kpi.value}`));
  }

  for (const ins of input.insights.slice(0, 3)) {
    const h = ins.evidence.highlights[0];
    lines.push(bullet(channel, h ? `${ins.evidence.title} — ${h.label}: ${h.value}` : ins.evidence.title));
  }

  const highSignals = input.signals.filter((s) => s.severity !== "info").slice(0, 2);
  for (const s of highSignals) {
    lines.push(`⚠️ ${s.title}: ${s.detail}`);
  }

  if (input.cleanSteps.length > 0) {
    const affected = input.cleanSteps.reduce((a, s) => a + (s.affectedRows || 0), 0);
    lines.push(
      `✅ تنظيف: ${input.cleanSteps.length} عملية${affected > 0 ? ` · ${affected.toLocaleString("en-US")} خلية/صف مُعالَج` : ""}`,
    );
  }

  lines.push("");
  lines.push("🔒 تم التحليل محلياً 100% داخل المتصفح عبر منصة بصيرة");
  return lines.join("\n");
}
