/**
 * اشتقاق محتوى التقرير حسب الجمهور المستهدف (تنفيذي / تحليلي / تشغيلي).
 * كل الدوال هنا اشتقاق بحت من نتائج الوحدات 3/4/6/7 — بلا استعلامات جديدة ولا AI.
 */
import type { HealthReport } from "@/lib/data-health";
import type { CleanStep } from "@/lib/cleaning";
import type { Row } from "@/lib/parse-file";
import { RECOMMENDATION_BY_INTENT, type PinnedInsight } from "@/lib/report";
import { cleanCell } from "@/lib/report-format";
import { formatLineageDependencies } from "@/lib/lineage-display";
import type { PlaybookId } from "@/lib/playbooks";
import { domainIntent, domainTail, pickVariant } from "@/lib/report-phrasing";

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
  const metric = keys.find((k) =>
    rows.some((r) => Number.isFinite(Number(r[k])) && r[k] !== null && r[k] !== ""),
  );
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
  kpis.push({
    label: "حجم البيانات المحلَّلة",
    value: `${fmt(rowCount)} × ${columnCount}`,
    hint: "صفوف × أعمدة",
  });
  if (health) {
    kpis.push({
      label: "موثوقية البيانات",
      value: `${health.score}%`,
      hint:
        health.score >= 80 ? "بيانات موثوقة" : health.score >= 50 ? "تحتاج مراجعة" : "مخاطر عالية",
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

/**
 * مصفوفة توصيات مبنية على الأرقام الفعلية (قواعد شرطية)، مع الرجوع
 * إلى التوصية العامة فقط عند غياب أرقام قابلة للاشتقاق.
 */
export function recommendationMatrix(
  insights: PinnedInsight[],
  health: HealthReport | null,
  domain?: PlaybookId,
): ActionItem[] {
  const items: ActionItem[] = insights.slice(0, 6).map((ins) => {
    const st = insightStats(ins);
    return {
      bucket: contextualBucket(ins, st),
      title: ins.evidence.title,
      text: withDomainTail(contextualRecommendation(ins, st), ins, domain),
    };
  });
  if (health && health.score < 80) {
    items.push({
      bucket: "risk",
      title: `جودة البيانات ${health.score}/100`,
      text: `عالج ${fmt(health.missingCells)} خلية مفقودة و${fmt(health.duplicateRows)} صف مكرر قبل بناء قرارات نهائية على هذه الأرقام.`,
    });
  }
  return items;
}

function withDomainTail(text: string, ins: PinnedInsight, domain: PlaybookId | undefined): string {
  const tail = domainTail(
    domain,
    domainIntent(ins.plan.intent),
    ins.evidence.id || ins.evidence.title,
  );
  return tail ? `${text} ${tail}` : text;
}

/** تصنيف التوصية حسب حدة الأرقام لا حسب نوع السؤال فقط. */
function contextualBucket(ins: PinnedInsight, st: InsightStats | null): ActionBucket {
  if (st) {
    const spread = st.mean === 0 ? 0 : (st.max.value - st.min.value) / Math.abs(st.mean);
    if (spread >= 3 || st.share >= 60) return "risk";
    if (st.points.length >= 3 && spread >= 1) return "growth";
  }
  return bucketOf(ins.plan.intent);
}

/** صياغة توصية مرتبطة بالرقم الناتج فعلياً (If/Else على قيم الاستنتاج). */
function contextualRecommendation(ins: PinnedInsight, st: InsightStats | null): string {
  if (!st || st.points.length < 2) {
    const base = RECOMMENDATION_BY_INTENT[ins.plan.intent];
    return pickVariant(
      ins.evidence.id || ins.evidence.title,
      [base, ...(INTENT_ALTERNATES[ins.plan.intent] ?? [])],
      "rec",
    );
  }
  const { max, min, mean, share, metricCol, points } = st;
  const k = ins.evidence.id || ins.evidence.title;

  if (share >= 50) {
    return pickVariant(
      k,
      [
        `«${max.label}» يستحوذ وحده على ${fmt(share)}% من «${metricCol}» (${fmt(max.value)} من ${fmt(st.total)}) — اعتماد مرتفع على عنصر واحد؛ وزّع الجهد أو أمّن بديلاً قبل أي تغيّر مفاجئ.`,
        `تركّز لافت: «${max.label}» يمثّل ${fmt(share)}% من «${metricCol}» (${fmt(max.value)} من أصل ${fmt(st.total)})؛ أي اضطراب فيه سيهزّ النتيجة كلها، فضع خطة بديلة مبكراً.`,
        `نصف «${metricCol}» تقريباً أو أكثر يرجع إلى «${max.label}» (${fmt(share)}%، أي ${fmt(max.value)} من ${fmt(st.total)}) — نوّع المصادر أو أمّن بدائل قبل أن يتغيّر هذا العنصر.`,
      ],
      "share",
    );
  }
  if (ins.plan.intent === "trend") {
    const diff =
      st.first.value === 0
        ? 0
        : ((st.last.value - st.first.value) / Math.abs(st.first.value)) * 100;
    return diff >= 0
      ? pickVariant(
          k,
          [
            `الاتجاه صاعد بنسبة ${fmt(diff)}% حتى «${st.last.label}» — ثبّت العوامل التي رفعت «${metricCol}» وراقب استمرارها في الفترة القادمة.`,
            `ارتفع «${metricCol}» بنسبة ${fmt(diff)}% حتى «${st.last.label}»؛ حدّد ما الذي دفع هذا الصعود وحافظ عليه، وتحقق أنه ليس قفزة مؤقتة.`,
          ],
          "up",
        )
      : pickVariant(
          k,
          [
            `الاتجاه هابط بنسبة ${fmt(Math.abs(diff))}% حتى «${st.last.label}» — افحص ما تغيّر بعد «${st.first.label}» وضع خطة تصحيح قبل تراكم الأثر.`,
            `تراجع «${metricCol}» بنسبة ${fmt(Math.abs(diff))}% حتى «${st.last.label}»؛ راجع الأسباب منذ «${st.first.label}» وتحرّك قبل أن يتسع التراجع.`,
          ],
          "down",
        );
  }
  const gap = mean === 0 ? 0 : ((max.value - min.value) / Math.abs(mean)) * 100;
  if (gap >= 150) {
    return pickVariant(
      k,
      [
        `الفجوة بين «${max.label}» (${fmt(max.value)}) و«${min.label}» (${fmt(min.value)}) تعادل ${fmt(gap)}% من المتوسط — راجع أسباب تراجع «${min.label}» وانقل ممارسات «${max.label}».`,
        `فارق كبير: «${max.label}» عند ${fmt(max.value)} و«${min.label}» عند ${fmt(min.value)} (${fmt(gap)}% من المتوسط)؛ افهم ما يميّز الأول وطبّقه على الثاني.`,
      ],
      "gap",
    );
  }
  const below = points.filter((p) => p.value < mean).length;
  return pickVariant(
    k,
    [
      `المتوسط ${fmt(mean)} في «${metricCol}» و${below} من ${points.length} عناصر تحته — ارفع أداء الفئة الأدنى بدل التركيز على «${max.label}» وحده.`,
      `${below} من ${points.length} عناصر دون متوسط «${metricCol}» (${fmt(mean)})؛ الأثر الأكبر في رفع الفئة الأدنى، لا في تعزيز «${max.label}» المتقدّم أصلاً.`,
    ],
    "below",
  );
}

/** صيغ بديلة لتوصية intent عند غياب أرقام كافية (الأولى هي RECOMMENDATION_BY_INTENT). */
const INTENT_ALTERNATES: Partial<Record<string, string[]>> = {
  ranking: ["قارن أعلى العناصر بأدناها، وابحث عن العامل المشترك في المتصدرين قبل تعميمه."],
  compare: ["كرّر المقارنة على فترة أو شريحة أخرى للتأكد أن الفرق ثابت وليس صدفة."],
  trend: ["راقب الاتجاه لفترة إضافية، وسجّل أي حدث خارجي في الفترة قبل تفسير التغيّر."],
  distribution: ["قارن التوزيع بتوقعك المسبق؛ أي انحراف كبير يستحق التحقق من جودة التسجيل."],
  anomaly: ["أعد فحص مصدر القيم الشاذة (إدخال، قياس، أو حالة حقيقية) قبل استبعادها أو اعتمادها."],
  summary: ["ابدأ من هذا الملخص ثم قسّم النتائج حسب الفئات للوصول إلى مكامن التأثير."],
};

/** إحصاءات رقمية مشتقة من صفوف نتيجة استنتاج واحد. */
export interface InsightStats {
  labelCol: string;
  metricCol: string;
  points: { label: string; value: number }[];
  total: number;
  mean: number;
  max: { label: string; value: number };
  min: { label: string; value: number };
  first: { label: string; value: number };
  last: { label: string; value: number };
  share: number;
}

export function insightStats(ins: PinnedInsight): InsightStats | null {
  const pick = pickLabelMetric(ins.rows);
  if (!pick) return null;
  const points = ins.rows
    .map((r) => ({ label: cleanCell(r[pick.label]), value: Number(r[pick.metric]) }))
    .filter((p) => Number.isFinite(p.value));
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => b.value - a.value);
  const total = points.reduce((a, b) => a + b.value, 0);
  const max = sorted[0]!;
  const min = sorted[sorted.length - 1]!;
  return {
    labelCol: pick.label,
    metricCol: pick.metric,
    points,
    total,
    mean: total / points.length,
    max,
    min,
    first: points[0]!,
    last: points[points.length - 1]!,
    share: total > 0 ? (max.value / total) * 100 : 0,
  };
}

/**
 * الاستنتاج الذهبي: جملة مبنية على الأرقام الفعلية الناتجة عن الاستعلام،
 * لا على وصف السؤال. تختلف الصياغة حسب نوع التحليل (intent).
 */
export function headlineInsights(insights: PinnedInsight[]): { title: string; line: string }[] {
  return insights.slice(0, 5).map((ins) => ({
    title: ins.evidence.title,
    line: headlineFor(ins),
  }));
}

function headlineFor(ins: PinnedInsight): string {
  const st = insightStats(ins);
  const metricName = st ? st.metricCol : "";
  const k = ins.evidence.id || ins.evidence.title;
  if (st && st.points.length >= 2) {
    switch (ins.plan.intent) {
      case "trend": {
        const diff =
          st.first.value === 0
            ? 0
            : ((st.last.value - st.first.value) / Math.abs(st.first.value)) * 100;
        const dirWord = st.last.value >= st.first.value ? "ارتفع" : "انخفض";
        return pickVariant(
          k,
          [
            `${dirWord} «${metricName}» من ${fmt(st.first.value)} عند «${st.first.label}» إلى ${fmt(st.last.value)} عند «${st.last.label}» بنسبة ${fmt(Math.abs(diff))}%، بمتوسط ${fmt(st.mean)} عبر ${st.points.length} نقطة.`,
            `بين «${st.first.label}» و«${st.last.label}» ${dirWord} «${metricName}» بنسبة ${fmt(Math.abs(diff))}% (من ${fmt(st.first.value)} إلى ${fmt(st.last.value)})، والمتوسط ${fmt(st.mean)} على ${st.points.length} نقطة.`,
          ],
          "h-trend",
        );
      }
      case "distribution":
        return pickVariant(
          k,
          [
            `تتركّز القيم في «${st.max.label}» بمقدار ${fmt(st.max.value)} أي ${fmt(st.share)}% من إجمالي ${fmt(st.total)}، بينما الأدنى «${st.min.label}» عند ${fmt(st.min.value)}.`,
            `«${st.max.label}» صاحب الحصة الأكبر: ${fmt(st.max.value)} (${fmt(st.share)}% من الإجمالي ${fmt(st.total)})، مقابل ${fmt(st.min.value)} فقط عند «${st.min.label}».`,
          ],
          "h-dist",
        );
      case "anomaly": {
        const over = st.mean === 0 ? 0 : ((st.max.value - st.mean) / Math.abs(st.mean)) * 100;
        return pickVariant(
          k,
          [
            `أبرز انحراف عند «${st.max.label}» بقيمة ${fmt(st.max.value)} مقابل متوسط ${fmt(st.mean)} — أي ${fmt(over)}% فوق المعدل.`,
            `«${st.max.label}» يخرج عن النمط: ${fmt(st.max.value)} مقابل متوسط ${fmt(st.mean)}، بزيادة ${fmt(over)}% عن المعدل.`,
          ],
          "h-anom",
        );
      }
      case "compare":
        return pickVariant(
          k,
          [
            `الفارق بين «${st.max.label}» (${fmt(st.max.value)}) و«${st.min.label}» (${fmt(st.min.value)}) يبلغ ${fmt(st.max.value - st.min.value)} في «${metricName}»، بمتوسط عام ${fmt(st.mean)}.`,
            `في «${metricName}» يتقدّم «${st.max.label}» (${fmt(st.max.value)}) على «${st.min.label}» (${fmt(st.min.value)}) بفارق ${fmt(st.max.value - st.min.value)}، والمتوسط العام ${fmt(st.mean)}.`,
          ],
          "h-cmp",
        );
      case "summary":
        return pickVariant(
          k,
          [
            `متوسط «${metricName}» بلغ ${fmt(st.mean)}، بإجمالي ${fmt(st.total)} ومدى يمتد من ${fmt(st.min.value)} («${st.min.label}») إلى ${fmt(st.max.value)} («${st.max.label}»).`,
            `إجمالي «${metricName}» ${fmt(st.total)} بمتوسط ${fmt(st.mean)}؛ أدنى قيمة ${fmt(st.min.value)} عند «${st.min.label}» وأعلاها ${fmt(st.max.value)} عند «${st.max.label}».`,
          ],
          "h-sum",
        );
      default:
        return pickVariant(
          k,
          [
            `يتصدّر «${st.max.label}» بقيمة ${fmt(st.max.value)} في «${metricName}» (${fmt(st.share)}% من الإجمالي ${fmt(st.total)})، مقابل «${st.min.label}» في الأدنى بـ ${fmt(st.min.value)}.`,
            `الصدارة لـ«${st.max.label}» بقيمة ${fmt(st.max.value)} في «${metricName}» — ${fmt(st.share)}% من إجمالي ${fmt(st.total)} — وفي الأدنى «${st.min.label}» عند ${fmt(st.min.value)}.`,
          ],
          "h-rank",
        );
    }
  }
  const hs = ins.evidence.highlights;
  if (hs.length > 0) {
    return (
      hs
        .slice(0, 3)
        .map((h) => `${h.label}: ${h.value}`)
        .join(" — ") + "."
    );
  }
  return ins.plan.intro_ar?.trim().split(/(?<=\.)\s/)[0] || ins.evidence.title;
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
export function anomalyAlerts(
  insights: PinnedInsight[],
  health: HealthReport | null,
): AnomalyAlert[] {
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
        title: `${String(r[pick.label] ?? "—")} — ${pick.metric}`,
        detail: `القيمة ${fmt(v)} ${diff >= 0 ? "أعلى" : "أدنى"} من المتوسط (${fmt(mean)}) بنسبة ${fmt(Math.abs(diff))}% ضمن «${ins.evidence.title}».`,
        level: Math.abs(z) >= 3 ? "bad" : "warn",
      });
      if (alerts.length >= 8) break;
    }
    if (alerts.length >= 8) break;
  }
  if (health) {
    for (const i of health.issues.filter((x) => x.severity === "bad").slice(0, 3)) {
      alerts.push({
        title: i.title,
        detail: `الصفوف المتأثرة: ${fmt(i.affectedRows)}.`,
        level: "bad",
      });
    }
  }
  return alerts.slice(0, 10);
}

export interface SqlLineageReportRow {
  insightTitle: string;
  sourceTable: string;
  outputName: string;
  expression: string;
  role: string;
  confidence: string;
  sourceDependencies: string[];
  valueDependencies: string[];
  conditionDependencies: string[];
  rowFilterDependencies: string[];
  operations: string[];
}

/** Build auditable, presentation-ready SQL dependency rows from pinned evidence only. */
export function buildSqlLineageReport(insights: PinnedInsight[]): SqlLineageReportRow[] {
  return insights.flatMap((insight) => {
    const lineage = insight.evidence.lineage;
    if (!lineage) return [];
    return lineage.outputColumns.map((column) => ({
      insightTitle: insight.evidence.title,
      sourceTable: lineage.sourceTable,
      outputName: column.outputName,
      expression: column.expression,
      role: column.role,
      confidence: column.confidence,
      sourceDependencies: formatLineageDependencies(column.sourceColumns, column.sourceReferences),
      valueDependencies: formatLineageDependencies(
        column.valueSourceColumns,
        column.valueSourceReferences,
      ),
      conditionDependencies: formatLineageDependencies(
        column.conditionSourceColumns,
        column.conditionSourceReferences,
      ),
      rowFilterDependencies: formatLineageDependencies(
        column.rowFilterSourceColumns,
        column.rowFilterSourceReferences,
      ),
      operations: column.operations,
    }));
  });
}

/** سجل التحويلات: صياغة عربية موثِّقة لكل خطوة تنظيف. */
const STEP_KIND_AR: Record<string, string> = {
  dedupe: "إزالة المكرر",
  trim: "تنظيف النصوص",
  cast: "تحويل النوع",
  fill: "ملء المفقود",
  fillgroup: "ملء بوسيط المجموعة (قيم مقدَّرة)",
  knn: "تقدير بالجيران الأقرب KNN (قيم مقدَّرة)",
  winsor: "قصّ القيم الشاذة (قيم معدَّلة)",
  merge: "توحيد الفئات",
  datefmt: "تنسيق التاريخ",
  arabic: "توحيد الكتابة العربية",
};

/** خطوات تُغيّر القيم نفسها بتقدير أو تعديل، فيجب التصريح بها في أي تقرير. */
const ESTIMATING_KINDS = new Set(["fill", "fillgroup", "knn", "winsor"]);

/** جملة تنبيه للتقارير إن وُجدت قيم مقدَّرة أو معدَّلة؛ وإلا null. */
export function estimatedValuesNote(steps: CleanStep[]): string | null {
  const est = steps.filter((s) => ESTIMATING_KINDS.has(s.kind));
  if (est.length === 0) return null;
  const total = est.reduce((sum, s) => sum + s.affectedRows, 0);
  return `تنبيه: ${fmt(total)} قيمة في ${est.length === 1 ? "خطوة واحدة" : `${est.length} خطوات`} (ملء/تقدير/قصّ) هي تقديرات أو تعديلات وليست قياسات أصلية؛ تعامل مع الأرقام المبنية عليها بحذر.`;
}

export function lineageLog(steps: CleanStep[]): { order: number; label: string; detail: string }[] {
  return steps.map((s, i) => {
    const kind = STEP_KIND_AR[s.kind] ?? s.kind;
    return {
      order: i + 1,
      label: s.label,
      detail:
        s.affectedRows > 0
          ? `الصفوف/القيم المتأثرة: ${fmt(s.affectedRows)} — النوع: ${kind}`
          : `النوع: ${kind} — بلا صفوف متأثرة مسجّلة`,
    };
  });
}

export interface ReportOverview {
  /** جملة وصف حجم البيانات وجودتها. */
  snapshot: string;
  /** أهم ما كُشف (حتى 3)، كل بند جملة مبنية على أرقام النتيجة. */
  findings: { title: string; line: string }[];
  /** تحفّظات يجب أن يعرفها القارئ قبل الاعتماد على الأرقام. */
  cautions: string[];
}

function pct1(ratio: number): string {
  const p = ratio * 100;
  return p > 0 && p < 0.1 ? "أقل من 0.1" : fmt(Math.round(p * 10) / 10);
}

/** نظرة عامة تلقائية لصفحة افتتاحية: تُبنى من الأدلة والأرقام الفعلية فقط. */
export function buildOverview(
  insights: PinnedInsight[],
  health: HealthReport | null,
  rowCount: number,
  columnCount: number,
  steps: CleanStep[],
): ReportOverview {
  const level = !health
    ? ""
    : health.score >= 80
      ? "بيانات موثوقة"
      : health.score >= 50
        ? "مقبولة مع تحفّظات"
        : "تحتاج معالجة قبل القرار";
  const snapshot =
    `يضم الملف ${fmt(rowCount)} صفاً و${columnCount} ${columnCount === 1 ? "عموداً" : "أعمدة"}` +
    (health ? `، وحصلت جودة البيانات على ${health.score} من 100 (${level}).` : ".");

  const findings = headlineInsights(insights).slice(0, 3);

  const cautions: string[] = [];
  if (health) {
    if (health.missingCells > 0)
      cautions.push(
        `${fmt(health.missingCells)} خلية فارغة (${pct1(health.missingRatio)}% من الخلايا).`,
      );
    if (health.duplicateRows > 0)
      cautions.push(
        `${fmt(health.duplicateRows)} صفاً مكرراً (${pct1(health.duplicateRatio)}% من الصفوف).`,
      );
    if (health.mismatchedColumns > 0)
      cautions.push(
        `${fmt(health.mismatchedColumns)} ${health.mismatchedColumns === 1 ? "عمود" : "أعمدة"} بأنواع قيم مختلطة.`,
      );
  }
  const est = estimatedValuesNote(steps);
  if (est) cautions.push(est.replace(/^تنبيه:\s*/, ""));
  if (steps.length > 0)
    cautions.push(
      `طُبّقت ${fmt(steps.length)} ${steps.length === 1 ? "خطوة" : "خطوات"} تنظيف على الملف، موثّقة في سجل التحويلات.`,
    );
  return { snapshot, findings, cautions };
}
