/**
 * اشتقاق محتوى التقرير حسب الجمهور المستهدف (تنفيذي / تحليلي / تشغيلي).
 * كل الدوال هنا اشتقاق بحت من نتائج الوحدات 3/4/6/7 — بلا استعلامات جديدة ولا AI.
 */
import type { HealthReport } from "@/lib/data-health";
import type { CleanStep } from "@/lib/cleaning";
import type { Row } from "@/lib/parse-file";
import { RECOMMENDATION_BY_INTENT, type PinnedInsight } from "@/lib/report";

export function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(n / 1000).toFixed(1)}K`;
  return Number.isInteger(n) ? n.toLocaleString("en-US") : n.toFixed(2);
}

/** أول عمود نصي (تسمية) وأول عمود رقمي (قياس) في صفوف النتيجة. */
export function pickLabelMetric(rows: Row[]): { label: string; metric: string } | null {
  const keys = Object.keys(rows[0] ?? {});
  if (keys.length < 2) return null;
  const metric = keys.find((k) => rows.some((r) => Number.isFinite(Number(r[k])) && r[k] !== null && r[k] !== ""));
  const label = keys.find((k) => k !== metric);
  if (!metric || !label) return null;
  return { label, metric };
}

export interface Kpi {
  label: string;
  value: string;
  hint: string;
}

/** 3–5 أرقام جوهرية للمدير. */
export function executiveKpis(
  insights: PinnedInsight[],
  health: HealthReport | null,
  rowCount: number,
  columnCount: number,
): Kpi[] {
  const kpis: Kpi[] = [];
  for (const ins of insights) {
    for (const h of ins.evidence.highlights.slice(0, 2)) {
      if (kpis.length >= 4) break;
      kpis.push({ label: h.label, value: h.value, hint: ins.evidence.title });
    }
    if (kpis.length >= 4) break;
  }
  kpis.push({ label: "حجم البيانات المحلَّلة", value: `${fmt(rowCount)} × ${columnCount}`, hint: "صفوف × أعمدة" });
  if (health) {
    kpis.push({
      label: "موثوقية البيانات",
      value: `${health.score}%`,
      hint: health.score >= 80 ? "بيانات موثوقة" : health.score >= 50 ? "تحتاج مراجعة" : "مخاطر عالية",
    });
  }
  return kpis.slice(0, 5);
}

export type ActionBucket = "immediate" | "growth" | "risk";

export interface ActionItem {
  bucket: ActionBucket;
  title: string;
  text: string;
}

export const BUCKET_LABEL: Record<ActionBucket, string> = {
  immediate: "إجراء فوري",
  growth: "فرصة نمو",
  risk: "تنبيه مخاطر",
};

function bucketOf(intent: PinnedInsight["plan"]["intent"]): ActionBucket {
  if (intent === "anomaly") return "risk";
  if (intent === "ranking" || intent === "trend") return "growth";
  if (intent === "compare") return "immediate";
  return "immediate";
}

/** مصفوفة توصيات مقسّمة إلى: إجراء فوري / فرصة نمو / تنبيه مخاطر. */
export function recommendationMatrix(insights: PinnedInsight[], health: HealthReport | null): ActionItem[] {
  const items: ActionItem[] = insights.slice(0, 6).map((ins) => ({
    bucket: bucketOf(ins.plan.intent),
    title: ins.evidence.title,
    text: RECOMMENDATION_BY_INTENT[ins.plan.intent],
  }));
  if (health && health.score < 80) {
    items.push({
      bucket: "risk",
      title: `جودة البيانات ${health.score}/100`,
      text: `عالج ${fmt(health.missingCells)} خلية مفقودة و${fmt(health.duplicateRows)} صف مكرر قبل بناء قرارات نهائية على هذه الأرقام.`,
    });
  }
  return items;
}

/** جملة واحدة واضحة لكل محور. */
export function headlineInsights(insights: PinnedInsight[]): { title: string; line: string }[] {
  return insights.slice(0, 5).map((ins) => {
    const top = ins.evidence.highlights[0];
    const line =
      ins.plan.intro_ar?.trim().split(/(?<=\.)\s/)[0] ||
      (top ? `${top.label}: ${top.value}.` : ins.evidence.title);
    return { title: ins.evidence.title, line };
  });
}

export interface RankedList {
  title: string;
  labelCol: string;
  metricCol: string;
  top: { label: string; value: number }[];
  bottom: { label: string; value: number }[];
}

/** قوائم أفضل 10 وأسوأ 10 من صفوف كل استنتاج. */
export function topBottomLists(insights: PinnedInsight[], limit = 10): RankedList[] {
  const out: RankedList[] = [];
  for (const ins of insights) {
    const pick = pickLabelMetric(ins.rows);
    if (!pick || ins.rows.length < 4) continue;
    const data = ins.rows
      .map((r) => ({ label: String(r[pick.label] ?? "—"), value: Number(r[pick.metric]) }))
      .filter((d) => Number.isFinite(d.value));
    if (data.length < 4) continue;
    const sorted = [...data].sort((a, b) => b.value - a.value);
    out.push({
      title: ins.evidence.title,
      labelCol: pick.label,
      metricCol: pick.metric,
      top: sorted.slice(0, limit),
      bottom: sorted.slice(-limit).reverse(),
    });
    if (out.length >= 2) break;
  }
  return out;
}

export interface AnomalyAlert {
  title: string;
  detail: string;
  level: "warn" | "bad";
}

/** تنبيهات انحراف: قيم تبعد أكثر من انحرافين معياريين + مشاكل الجودة الحادة. */
export function anomalyAlerts(insights: PinnedInsight[], health: HealthReport | null): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  for (const ins of insights) {
    const pick = pickLabelMetric(ins.rows);
    if (!pick) continue;
    const vals = ins.rows.map((r) => Number(r[pick.metric])).filter(Number.isFinite);
    if (vals.length < 5) continue;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    if (sd === 0) continue;
    for (const r of ins.rows) {
      const v = Number(r[pick.metric]);
      if (!Number.isFinite(v)) continue;
      const z = (v - mean) / sd;
      if (Math.abs(z) < 2) continue;
      const diff = mean === 0 ? 0 : ((v - mean) / Math.abs(mean)) * 100;
      alerts.push({
        title: `${String(r[pick.label] ?? "—")} — ${pick.metricCol ?? pick.metric}`,
        detail: `القيمة ${fmt(v)} ${diff >= 0 ? "أعلى" : "أدنى"} من المتوسط (${fmt(mean)}) بنسبة ${fmt(Math.abs(diff))}% ضمن «${ins.evidence.title}».`,
        level: Math.abs(z) >= 3 ? "bad" : "warn",
      });
      if (alerts.length >= 8) break;
    }
    if (alerts.length >= 8) break;
  }
  if (health) {
    for (const i of health.issues.filter((x) => x.severity === "bad").slice(0, 3)) {
      alerts.push({ title: i.title, detail: `الصفوف المتأثرة: ${fmt(i.affectedRows)}.`, level: "bad" });
    }
  }
  return alerts.slice(0, 10);
}

/** سجل التحويلات: صياغة عربية موثِّقة لكل خطوة تنظيف. */
export function lineageLog(steps: CleanStep[]): { order: number; label: string; detail: string }[] {
  return steps.map((s, i) => ({
    order: i + 1,
    label: s.label,
    detail:
      s.affectedRows > 0
        ? `الصفوف المتأثرة: ${fmt(s.affectedRows)} — النوع: ${s.kind}`
        : `النوع: ${s.kind} — بلا صفوف متأثرة مسجّلة`,
  }));
}
