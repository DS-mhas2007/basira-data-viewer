/**
 * الوحدة 8: مستند التقرير التنفيذي (يُرسم خارج الشاشة ثم يُحوَّل إلى PDF).
 * ألوان الهوية ثابتة هنا عمداً لأن مخرج PDF لا يرث متغيّرات الثيم.
 */

import { useEffect, useRef, useState } from "react";
import { EChartsView } from "@/components/EChartsView";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
} from "@/components/icons";
import type { EChartsOption } from "echarts";
import { severityOfScore, type HealthReport } from "@/lib/data-health";
import type { CleanStep } from "@/lib/cleaning";
import type { AiPlan } from "@/lib/ai-query.functions";
import type { Row } from "@/lib/parse-file";
import {
  arabicDate,
  audienceMeta,
  type PinnedInsight,
  type ReportAudience,
  type ReportSections,
} from "@/lib/report";
import {
  anomalyAlerts,
  BUCKET_LABEL,
  executiveKpis,
  fmt,
  headlineInsights,
  estimatedValuesNote,
  buildOverview,
  lineageLog,
  buildSqlLineageReport,
  recommendationMatrix,
  topBottomLists,
  type ActionBucket,
} from "@/lib/report-derive";
import { cleanCell, dirOf, formatSql, tokenizeSql } from "@/lib/report-format";
import type { PlaybookId } from "@/lib/playbooks";
import type { ReportTemplateId } from "@/lib/report-template";
import { REPORT_THEMES, type ReportTheme, type ReportThemeId } from "@/lib/report-theme";

/**
 * ألوان الثيم الحالي. تُضبط مرة واحدة في بداية كل رسم لـ ReportDocument (applyTheme) قبل رسم أي ابن،
 * فتبقى الأنماط القديمة تقرأ نفس الأسماء دون تمرير الثيم عبر كل مكوّن.
 */
let NAVY = REPORT_THEMES.light.surface;
let PAPER = REPORT_THEMES.light.page;
let TEAL = REPORT_THEMES.light.accent;
let MINT = REPORT_THEMES.light.accent;
let VIOLET = REPORT_THEMES.light.accent2;
let LAVENDER = REPORT_THEMES.light.accent2;
let TEXT = REPORT_THEMES.light.text;
let MUTED = REPORT_THEMES.light.muted;
let COVER_TEXT = REPORT_THEMES.light.text;
let COVER_MUTED = REPORT_THEMES.light.muted;
let COVER_ACCENT = REPORT_THEMES.light.coverAccent;
let COVER_ACCENT2 = REPORT_THEMES.light.coverAccent2;
let LINE = REPORT_THEMES.light.line;
let CARD = REPORT_THEMES.light.card;
let ACTIVE: ReportTheme = REPORT_THEMES.light;
/** نص الترويسة الجارية (اسم الملف + نوع التقرير). */
let MODERN = false;
let HEADER_TEXT: { left: string; right: string } = { left: "", right: "" };

import { PAGE_H, PAGE_W } from "@/lib/report-page";
export { PAGE_H, PAGE_W };
const PAD = 52;

let SCORE_COLOR: { good: string; warn: string; bad: string } = {
  good: REPORT_THEMES.light.good,
  warn: REPORT_THEMES.light.warn,
  bad: REPORT_THEMES.light.bad,
};
let CHART_COLORS: string[] = [...REPORT_THEMES.light.chart];

function applyTheme(t: ReportTheme) {
  ACTIVE = t;
  NAVY = t.surface;
  PAPER = t.page;
  TEAL = t.accent;
  MINT = t.accent;
  VIOLET = t.accent2;
  LAVENDER = t.accent2;
  TEXT = t.text;
  MUTED = t.muted;
  COVER_TEXT = t.text;
  COVER_MUTED = t.muted;
  COVER_ACCENT = t.coverAccent;
  COVER_ACCENT2 = t.coverAccent2;
  LINE = t.line;
  CARD = t.card;
  SCORE_COLOR = { good: t.good, warn: t.warn, bad: t.bad };
  CHART_COLORS = [...t.chart];
  SQL_COLOR = { ...t.sql };
}

function Page({
  children,
  index,
  total,
  footer = true,
  title,
  tocLabel,
  variant = "paper",
}: {
  children: React.ReactNode;
  index: number;
  total: number;
  footer?: boolean;
  /** اسم القسم — يُستخدم عند تصدير الصفحة كصورة PNG مستقلة. */
  title?: string;
  /** عنوان بديل يظهر في الفهرس. */
  tocLabel?: string;
  variant?: "paper" | "cover";
}) {
  return (
    <div
      data-pdf-page=""
      data-page-index={index}
      data-section-title={title ?? `صفحة ${index}`}
      data-toc-label={tocLabel ?? ""}
      data-pdf-font="Changa"
      dir="rtl"
      style={{
        position: "relative",
        width: PAGE_W,
        height: PAGE_H,
        backgroundColor: variant === "cover" && !ACTIVE.dark ? NAVY : PAPER,
        backgroundImage:
          variant === "cover" && ACTIVE.dark
            ? `radial-gradient(ellipse 70% 45% at 85% 8%, ${COVER_ACCENT2}33 0%, transparent 70%), radial-gradient(ellipse 80% 50% at 10% 100%, ${COVER_ACCENT}26 0%, transparent 70%)`
            : ACTIVE.dark
              ? "none"
              : "repeating-linear-gradient(0deg, rgba(28,41,48,0.014) 0px, rgba(28,41,48,0.014) 1px, transparent 1px, transparent 5px)",
        color: variant === "cover" ? COVER_TEXT : TEXT,
        fontFamily: '"Changa", "Tajawal", sans-serif',
        lineHeight: 1.65,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {MODERN && variant !== "cover" && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            insetInline: 0,
            top: 0,
            height: 8,
            background: `linear-gradient(90deg, ${TEAL}, ${VIOLET})`,
          }}
        />
      )}
      {footer && HEADER_TEXT.left && (
        <div
          dir="auto"
          style={{
            position: "absolute",
            insetInline: PAD,
            top: 20,
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 10,
            color: MUTED,
            opacity: 0.85,
          }}
        >
          <span
            dir="auto"
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: "60%",
            }}
          >
            {HEADER_TEXT.left}
          </span>
          <span style={{ whiteSpace: "nowrap" }}>{HEADER_TEXT.right}</span>
        </div>
      )}
      <div
        data-pdf-content=""
        style={{
          padding: PAD,
          height: PAGE_H - (footer ? 64 : 0),
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
      {footer && (
        <div
          style={{
            position: "absolute",
            insetInline: PAD,
            bottom: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `1px solid ${LINE}`,
            paddingTop: 12,
            fontSize: 11,
            color: MUTED,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
            <BrandSignature compact />
            تقارير مساحة العمل
          </span>
          <span
            dir="ltr"
            style={{
              fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace',
              whiteSpace: "nowrap",
            }}
          >
            صفحة {index} من {total}
          </span>
        </div>
      )}
    </div>
  );
}

function BrandSignature({ compact = false }: { compact?: boolean; inverse?: boolean }) {
  // شعار MIZYAi الرسمي (lockup) بحسب خلفية الثيم: dark للخلفية الداكنة، light للفاتحة.
  const src = `/brand/mizya-lockup-horizontal-${ACTIVE.lockup}-640.png`;
  return (
    <img
      src={src}
      alt="MIZYAi"
      crossOrigin="anonymous"
      style={{
        display: "block",
        height: compact ? 18 : 52,
        width: "auto",
        marginInline: compact ? 0 : "auto",
      }}
    />
  );
}

/** صفحة الفهرس: تقرأ عناوين الصفحات وأرقامها من DOM بعد الرسم، فتبقى صحيحة مهما تغيّر الدمج. */
function TocPage({ rootRef }: { rootRef: React.RefObject<HTMLDivElement | null> }) {
  const [items, setItems] = useState<{ index: number; title: string }[]>([]);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const found = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-page]"))
      .map((el) => ({
        index: Number(el.dataset["pageIndex"]),
        title: (el.dataset["tocLabel"] || el.dataset["sectionTitle"]) ?? "",
      }))
      .filter((x) => x.index > 2 && x.title);
    setItems((prev) => (JSON.stringify(prev) === JSON.stringify(found) ? prev : found));
  });
  return (
    <>
      <SectionTitle>فهرس المحتويات</SectionTitle>
      <ol style={{ listStyle: "none", margin: "18px 0 0", padding: 0, display: "grid", gap: 2 }}>
        {items.map((it) => (
          <li
            key={it.index}
            data-toc-target={it.index}
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 10,
              padding: "7px 0",
              borderBottom: `1px dashed ${LINE}`,
              fontSize: 14,
            }}
          >
            <span dir="auto" style={{ fontWeight: 600 }}>
              {it.title}
            </span>
            <span style={{ flex: 1 }} />
            <span
              dir="ltr"
              style={{
                fontFamily: '"IBM Plex Mono", "Changa", monospace',
                color: TEAL,
                fontSize: 13,
              }}
            >
              {it.index}
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

function AiNarrationBadge() {
  return (
    <p dir="auto" style={{ margin: "6px 0 0", fontSize: 10, color: MUTED, opacity: 0.9 }}>
      <Sparkles
        size={12}
        style={{
          display: "inline-block",
          color: VIOLET,
          verticalAlign: "-2px",
          marginInlineEnd: 4,
        }}
      />{" "}
      صياغة مساعدة بالذكاء الاصطناعي — كل الأرقام فيها مطابقة لنتيجة التحليل المعروضة.
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  if (MODERN) {
    return (
      <h2
        style={{
          fontSize: 26,
          lineHeight: 1.55,
          fontWeight: 700,
          margin: "0 0 10px",
          paddingBottom: 6,
          borderBottom: `2px solid ${TEAL}`,
        }}
      >
        {children}
      </h2>
    );
  }
  return (
    <h2
      style={{
        fontSize: 25,
        lineHeight: 1.55,
        fontWeight: 700,
        margin: "0 0 8px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span
        style={{ width: 6, height: 26, borderRadius: 3, background: TEAL, display: "inline-block" }}
      />
      {children}
    </h2>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${LINE}`,
        borderRadius: MODERN ? 4 : "18px 18px 18px 7px",
        ...(MODERN ? { borderTop: `3px solid ${TEAL}` } : {}),
        padding: 18,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function num(n: number) {
  return n.toLocaleString("en-US");
}

function ReportChart({ plan, rows, height = 250 }: { plan: AiPlan; rows: Row[]; height?: number }) {
  const keys = Object.keys(rows[0] ?? {});
  if (keys.length === 0) return null;
  const x = plan.chart.x && keys.includes(plan.chart.x) ? plan.chart.x : keys[0]!;
  const ys = plan.chart.y.filter((k) => keys.includes(k) && k !== x);
  const metrics =
    ys.length > 0
      ? ys
      : keys.filter((k) => k !== x && rows.some((r) => Number.isFinite(Number(r[k])))).slice(0, 2);

  if (plan.chart.type === "kpi" || plan.chart.type === "table" || metrics.length === 0) return null;

  const data = rows.slice(0, 24).map((r) => {
    const o: Record<string, unknown> = { [x]: cleanCell(r[x]) };
    for (const m of metrics) o[m] = Number(r[m] ?? 0);
    return o;
  });
  const chartHasArabicLabels = data.some((point) =>
    /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(String(point[x] ?? "")),
  );

  const w = PAGE_W - PAD * 2 - 36;
  const longest = data.reduce((m, d) => Math.max(m, String(d[x] ?? "").length), 0);
  const tilted = longest > 10;
  const bottom = tilted ? 30 + Math.min(48, longest * 2.6) : 30;
  const h = height + (tilted ? Math.min(40, longest * 2) : 0);

  const series: NonNullable<EChartsOption["series"]> =
    plan.chart.type === "scatter"
      ? [
          {
            name: metrics[0] ?? x,
            type: "scatter" as const,
            data: data.map((point) => [
              String(point[x] ?? ""),
              Number(point[metrics[0] ?? x] ?? 0),
            ]),
            symbolSize: 9,
          },
        ]
      : plan.chart.type === "line"
        ? metrics.map((metric, i) => ({
            name: metric,
            type: "line" as const,
            data: data.map((point) => Number(point[metric] ?? 0)),
            smooth: true,
            showSymbol: false,
            lineStyle: { width: 2 },
            emphasis: { focus: "series" as const },
            color: CHART_COLORS[i % CHART_COLORS.length] ?? CHART_COLORS[0]!,
          }))
        : metrics.map((metric, i) => ({
            name: metric,
            type: "bar" as const,
            data: data.map((point) => Number(point[metric] ?? 0)),
            itemStyle: { borderRadius: [5, 5, 0, 0] },
            emphasis: { focus: "series" as const },
            color: CHART_COLORS[i % CHART_COLORS.length] ?? CHART_COLORS[0]!,
          }));

  const option: EChartsOption = {
    animation: false,
    color: CHART_COLORS,
    ...(chartHasArabicLabels ? { textStyle: { fontFamily: "Changa" } } : {}),
    grid: { left: 12, right: 16, top: 16, bottom: bottom + 8, containLabel: true },
    tooltip: { trigger: plan.chart.type === "scatter" ? ("item" as const) : ("axis" as const) },
    ...(metrics.length > 1
      ? { legend: { bottom: 0, textStyle: { color: MUTED, fontSize: 10 } } }
      : {}),
    xAxis:
      plan.chart.type === "scatter"
        ? { type: "value" as const, name: x, axisLabel: { color: MUTED, fontSize: 10 } }
        : {
            type: "category" as const,
            data: data.map((point) => String(point[x] ?? "")),
            axisLabel: {
              color: MUTED,
              fontSize: 10,
              interval: 0,
              rotate: tilted ? 45 : 0,
            },
            axisLine: { lineStyle: { color: LINE } },
          },
    yAxis: {
      type: "value" as const,
      axisLabel: { color: MUTED, fontSize: 10 },
      splitLine: { lineStyle: { color: LINE, type: "dashed" } },
    },
    series,
  };

  return (
    <Card style={{ padding: 18 }}>
      <div dir="ltr" style={{ direction: "ltr", width: w, height: h }}>
        <EChartsView
          option={option}
          className="h-full w-full"
          label={plan.chart.type + " report chart"}
          pdfExport
        />
      </div>
    </Card>
  );
}

function MethodologyContent({
  showEmptyLineageNote,
  compact = false,
}: {
  showEmptyLineageNote: boolean;
  compact?: boolean;
}) {
  return (
    <ul
      style={{
        margin: compact ? "8px 0 0" : "12px 0 0",
        paddingInlineStart: 22,
        fontSize: compact ? 10.8 : 12.5,
        lineHeight: compact ? 1.55 : 2,
        color: MUTED,
        listStyleType: "disc",
      }}
    >
      <li>
        عولجت البيانات محلياً داخل متصفح المستخدم عبر محرك DuckDB ولم يُرفع الملف الأصلي. وعند
        استخدام ميزات الذكاء الاصطناعي أُرسلت أسماء الأعمدة وعيّنة صغيرة أو نتائج استعلامات مُجمّعة
        إلى مزوّد النموذج.
      </li>
      <li>
        كل استنتاج مبني على استعلام SQL قابل للتدقيق، ويمكن عرضه ونسخه من بطاقة الدليل داخل واجهة
        MIZYA عبر قسم «عرض الاستعلام SQL».
      </li>
      <li>
        درجة جودة البيانات محسوبة بأوزان ثابتة: القيم المفقودة 40، التكرار 30، تعارض الأنواع 30.
      </li>
      <li>اكتشاف القيم الشاذة إحصائي بطبيعته (انحراف معياري)، وليس إثباتاً قاطعاً على وجود خطأ.</li>
      <li>
        عمليات التنظيف غير تدميرية: الملف الأصلي لم يُعدَّل، وكل تحويل يمكن التراجع عنه داخل
        الواجهة.
      </li>
      {showEmptyLineageNote && (
        <li>لم تُطبَّق عمليات تنظيف على هذا المصدر؛ لذلك لا توجد خطوات في سجل التحويلات.</li>
      )}
      <li>هذا التقرير لا يغني عن مراجعة محلل بيانات خبير في القرارات عالية المخاطر.</li>
    </ul>
  );
}

export interface ReportData {
  fileName: string;
  health: HealthReport | null;
  rowCount: number;
  columnCount: number;
  cleanSteps: CleanStep[];
  insights: PinnedInsight[];
  date: Date;
  /** الجمهور المستهدف — يحدد الهيكل ومستوى التفاصيل. */
  audience: ReportAudience;
  /** الأقسام المفعّلة (مشتقة من الجمهور أو مخصّصة يدوياً). */
  sections: ReportSections;
  /** هل الاستنتاجات مولّدة تلقائياً (بلا تثبيت من المستخدم)؟ */
  autoGenerated?: boolean;
  /** معرّفات الاستنتاجات التي أُعيدت صياغة نصها بالذكاء الاصطناعي (بعد التحقق من الأرقام). */
  aiNarratedIds?: string[];
  /** ثيم التقرير (الافتراضي: فاتح ورقي). */
  theme?: ReportThemeId;
  /** قالب التخطيط (الافتراضي: كلاسيكي). */
  template?: ReportTemplateId;
  /** نوع البيانات المكتشف (playbook) لتخصيص عبارات التوصيات. */
  domain?: PlaybookId;
  /** ختم المصداقية الرقمي (بصمة SHA-256 محلية). */
  seal?: { shortHash: string; issuedAt: string } | null;
}

let SQL_COLOR: { kw: string; str: string; num: string; plain: string } = {
  ...REPORT_THEMES.light.sql,
};

/** كود SQL مُجمَّل ومُلوَّن بخط أحادي المسافة، باتجاه LTR ثابت. */
function SqlBlock({ sql, compact = false }: { sql: string; compact?: boolean }) {
  const lines = formatSql(sql).split("\n");
  return (
    <pre
      dir="ltr"
      style={{
        margin: 0,
        background: NAVY,
        border: `1px solid ${LINE}`,
        borderRadius: compact ? 8 : 10,
        padding: compact ? "8px 10px" : 12,
        fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace',
        fontSize: compact ? 9.5 : 10.5,
        lineHeight: compact ? 1.45 : 1.7,
        color: TEXT,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        maxHeight: compact ? 240 : 300,
        overflow: "hidden",
        textAlign: "left",
        unicodeBidi: "isolate",
      }}
    >
      {lines.map((line, i) => (
        <div key={i}>
          {tokenizeSql(line).map((t, j) => (
            <span
              key={j}
              style={{ color: SQL_COLOR[t.kind], fontWeight: t.kind === "kw" ? 700 : 400 }}
            >
              {t.text}
            </span>
          ))}
        </div>
      ))}
    </pre>
  );
}

function Kpis({
  items,
  big = false,
  compact = false,
}: {
  items: ReturnType<typeof executiveKpis>;
  big?: boolean;
  compact?: boolean;
}) {
  // التقرير التنفيذي: ثلاثة مؤشرات ضخمة فقط بدل شبكة مزدحمة.
  const list = big ? items.slice(0, 3) : items;
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: big || list.length <= 3 ? "1fr" : "1fr 1fr",
        gap: big ? 16 : compact ? 7 : 12,
      }}
    >
      {list.map((k, i) => (
        <Card key={i} style={{ padding: big ? 26 : compact ? 9 : 18 }}>
          <p style={{ margin: 0, fontSize: big ? 15 : compact ? 10.5 : 13, color: MUTED }}>
            {k.label}
          </p>
          <p
            dir="auto"
            style={{
              margin: compact ? "4px 0 0" : "8px 0 0",
              fontSize: big ? 62 : compact ? 29 : 42,
              fontWeight: 700,
              lineHeight: 1.1,
              color: i % 2 === 0 ? TEAL : VIOLET,
              fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace',
              wordBreak: "break-word",
            }}
          >
            {k.value}
          </p>
          <p
            dir="auto"
            style={{
              margin: compact ? "4px 0 0" : "8px 0 0",
              fontSize: big ? 13 : compact ? 9.5 : 11.5,
              color: MUTED,
            }}
          >
            {k.hint}
          </p>
        </Card>
      ))}
    </div>
  );
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const BUCKET_COLOR: Record<ActionBucket, string> = {
  get immediate() {
    return TEAL;
  },
  get growth() {
    return VIOLET;
  },
  get risk() {
    return SCORE_COLOR.warn;
  },
};

/** يبني صفحات التقرير حسب الجمهور والأقسام المختارة. */
/** نقطة الدخول: تختار القالب ثم ترسم الوثيقة بالثيم المطلوب. */
export function ReportDocument({ data }: { data: ReportData }) {
  const template = data.template ?? "classic";
  MODERN = template === "modern";
  if (template === "brief") return <BriefDocument data={data} />;
  if (template === "narrative") return <NarrativeDocument data={data} />;
  return <FullDocument data={data} />;
}

function FullDocument({ data }: { data: ReportData }) {
  applyTheme(REPORT_THEMES[data.theme ?? "light"]);
  const rootRef = useRef<HTMLDivElement>(null);
  HEADER_TEXT = {
    left: data.fileName,
    right: `MIZYAi · ${audienceMeta(data.audience).label}`,
  };
  const s = data.sections;
  const h = data.health;
  const severity = h ? severityOfScore(h.score) : "good";
  const insights =
    s.insights || s.headline || s.actions || s.sql || s.topBottom || s.anomalies
      ? data.insights.slice(0, 5)
      : [];
  const meta = audienceMeta(data.audience);

  const showOverview = data.audience !== "executive";
  const overview = showOverview
    ? buildOverview(data.insights, h, data.rowCount, data.columnCount, data.cleanSteps)
    : null;
  const kpis = s.kpi ? executiveKpis(insights, h, data.rowCount, data.columnCount) : [];
  const headlines = s.headline ? headlineInsights(insights) : [];
  const actions = s.actions ? recommendationMatrix(insights, h, data.domain) : [];
  const lists = s.topBottom ? topBottomLists(insights) : [];
  const alerts = s.anomalies ? anomalyAlerts(insights, h) : [];
  const lineage = s.lineage ? lineageLog(data.cleanSteps) : [];
  const sqlLineageRows = s.lineage ? buildSqlLineageReport(data.insights) : [];
  const sqlLineagePages = chunk(sqlLineageRows, 4);
  const healthLogPages = s.healthLog && h ? chunk(h.columns, 14) : [];
  const sqlPages = s.sql ? chunk(insights, 2) : [];
  const numericHealthColumns = h?.columns.filter((column) => column.isNumeric).slice(0, 16) ?? [];
  const summaryTextLength = [
    ...headlines.map((item) => item.line),
    ...actions.map((item) => `${item.title} ${item.text}`),
  ].join(" ").length;
  // Combine small summary sections only when their content comfortably fits one A4 page.
  const combineSummary =
    headlines.length > 0 &&
    actions.length > 0 &&
    headlines.length <= 2 &&
    actions.length <= 3 &&
    summaryTextLength <= 1400;
  const totalSqlLength = insights.reduce(
    (length, insight) => length + insight.evidence.sql.length,
    0,
  );
  const combineSqlAndMethodology =
    sqlPages.length === 1 && insights.length <= 2 && s.methodology && totalSqlLength <= 600;
  const combineKpiAndSummary =
    combineSummary && s.kpi && kpis.length > 0 && kpis.length <= 5 && summaryTextLength <= 900;
  const combineQualitySections = Boolean(
    s.health &&
    s.healthLog &&
    h &&
    healthLogPages.length === 1 &&
    h.columns.length <= 10 &&
    numericHealthColumns.length <= 5,
  );
  const combineTopBottom =
    lists.length === 2 && lists.every((list) => list.top.length <= 10 && list.bottom.length <= 10);
  const combineRankingWithSingleInsight = Boolean(
    s.insights &&
    lists.length === 1 &&
    insights.length === 1 &&
    lists[0]!.top.length <= 8 &&
    lists[0]!.bottom.length <= 8 &&
    (insights[0]!.plan.intro_ar?.length ?? 0) <= 350 &&
    (insights[0]!.plan.analysis_ar?.length ?? 0) <= 600,
  );
  const alertTextLength = alerts.reduce(
    (length, alert) => length + alert.title.length + alert.detail.length,
    0,
  );
  const combineAlertsWithStats = Boolean(
    !combineQualitySections &&
    alerts.length === 1 &&
    alertTextLength <= 260 &&
    s.stats &&
    h &&
    numericHealthColumns.length > 0 &&
    numericHealthColumns.length <= 5,
  );
  const combineAlertsWithMethodology = Boolean(
    alerts.length > 0 &&
    alerts.length <= 2 &&
    alertTextLength <= 520 &&
    s.methodology &&
    !combineSqlAndMethodology &&
    !combineAlertsWithStats,
  );
  const combineAlertsWithSql = Boolean(
    alerts.length > 0 &&
    alerts.length <= 2 &&
    alertTextLength <= 520 &&
    combineSqlAndMethodology &&
    !combineAlertsWithStats,
  );

  // حساب عدد الصفحات مسبقاً حتى يظهر ترقيم صحيح "x / y".
  const summaryPages =
    (headlines.length > 0 ? 1 : 0) + (actions.length > 0 ? 1 : 0) - (combineSummary ? 1 : 0);
  const qualityPages = combineQualitySections
    ? 1
    : (s.health ? 1 : 0) +
      healthLogPages.length +
      (s.stats && h && numericHealthColumns.length > 0 ? 1 : 0);
  const baseTotal =
    1 +
    (showOverview ? 1 : 0) +
    (s.kpi ? 1 : 0) +
    summaryPages -
    (combineKpiAndSummary ? 1 : 0) +
    qualityPages +
    (lineage.length > 0 ? 1 : 0) +
    sqlLineagePages.length +
    (combineTopBottom || combineRankingWithSingleInsight ? 1 : lists.length) +
    (alerts.length > 0 &&
    !combineAlertsWithStats &&
    !combineAlertsWithMethodology &&
    !combineAlertsWithSql
      ? 1
      : 0) +
    (s.insights ? insights.length - (combineRankingWithSingleInsight ? 1 : 0) : 0) +
    sqlPages.length +
    (s.methodology && !combineSqlAndMethodology ? 1 : 0);
  // فهرس المحتويات يُضاف عندما يكون التقرير طويلاً بما يكفي (5 صفحات فأكثر قبل الفهرس).
  const hasToc = baseTotal >= 5;
  const total = baseTotal + (hasToc ? 1 : 0);
  let page = 0;

  return (
    <div ref={rootRef}>
      {/* 1) الغلاف */}
      <Page index={++page} total={total} footer={false} title="الغلاف" variant="cover">
        <div
          style={{
            position: "absolute",
            inset: 0,
          }}
        />
        <div
          style={{
            position: "relative",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <BrandSignature />
          <div>
            <p style={{ margin: 0, fontSize: 20, color: MINT, fontWeight: 700, letterSpacing: 2 }}>
              MIZYAi INTELLIGENCE
            </p>
            <h1 style={{ margin: "10px 0 0", fontSize: 48, fontWeight: 700, lineHeight: 1.25 }}>
              {meta.label}
            </h1>
            <p style={{ margin: "10px 0 0", fontSize: 15, color: LAVENDER }}>
              موجَّه إلى: {meta.audience}
            </p>
          </div>
          <div style={{ height: 4, width: 180, borderRadius: 2, background: TEAL }} />
          <div style={{ fontSize: 16, lineHeight: 2.1, color: COVER_MUTED }}>
            <p style={{ margin: 0 }}>
              الملف المُحلَّل:{" "}
              <span dir="auto" style={{ color: COVER_TEXT, fontWeight: 600 }}>
                {data.fileName}
              </span>
            </p>
            <p style={{ margin: 0 }}>
              تاريخ إنشاء التقرير:{" "}
              <span style={{ color: COVER_TEXT }}>{arabicDate(data.date)}</span>
            </p>
            {h && (
              <p style={{ margin: 0 }}>
                جودة البيانات:{" "}
                <span
                  data-pdf-cover-score=""
                  style={{
                    color:
                      severity === "good"
                        ? MINT
                        : severity === "warn"
                          ? SCORE_COLOR.warn
                          : SCORE_COLOR.bad,
                  }}
                >
                  {severity === "good" ? (
                    <CheckCircle2
                      size={14}
                      style={{ display: "inline-block", verticalAlign: "-2px", marginInlineEnd: 4 }}
                    />
                  ) : severity === "warn" ? (
                    <AlertTriangle
                      size={14}
                      style={{ display: "inline-block", verticalAlign: "-2px", marginInlineEnd: 4 }}
                    />
                  ) : (
                    <AlertCircle
                      size={14}
                      style={{ display: "inline-block", verticalAlign: "-2px", marginInlineEnd: 4 }}
                    />
                  )}{" "}
                  موثوقة بنسبة {h.score}%
                </span>
              </p>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: COVER_MUTED }}>
            تمت عمليات التحليل محلياً داخل متصفحك ولم يُرفع الملف الأصلي إلى أي خادم.
          </p>
          {data.autoGenerated && (
            <p style={{ margin: 0, fontSize: 12, color: COVER_MUTED }}>
              الاستنتاجات في هذا التقرير قياسية، بُنيت تلقائياً من أنواع الأعمدة (ملخص، ترتيب، اتجاه
              زمني) ولم يثبّتها المستخدم؛ ثبّت استنتاجاتك لتخصيصها.
            </p>
          )}
          {data.seal && (
            <div
              style={{
                marginTop: 6,
                display: "inline-flex",
                flexDirection: "column",
                gap: 4,
                border: `1px solid ${MINT}66`,
                borderRadius: 14,
                padding: "12px 18px",
                background: ACTIVE.dark ? "rgba(96,245,210,0.08)" : "rgba(40,127,116,0.07)",
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: MINT, fontWeight: 700 }}>
                <ShieldCheck
                  size={15}
                  style={{ display: "inline-block", verticalAlign: "-3px", marginInlineEnd: 5 }}
                />
                ختم المصداقية — تحليل محلي موثّق
              </p>
              <p
                dir="ltr"
                style={{ margin: 0, fontSize: 11, color: COVER_MUTED, fontFamily: "monospace" }}
              >
                SHA-256: {data.seal.shortHash}…
              </p>
              <p style={{ margin: 0, fontSize: 11, color: COVER_MUTED }}>
                {new Date(data.seal.issuedAt).toLocaleString("ar-EG")}
              </p>
            </div>
          )}
        </div>
      </Page>

      {hasToc && (
        <Page index={++page} total={total} title="فهرس المحتويات">
          <TocPage rootRef={rootRef} />
        </Page>
      )}

      {/* لوحة موجزة: المؤشرات والاستنتاجات والتوصيات */}
      {combineKpiAndSummary && (
        <Page index={++page} total={total} title="الملخص التنفيذي">
          <SectionTitle>ملخص الأداء</SectionTitle>
          <p style={{ color: MUTED, fontSize: 12.5, margin: "0 0 12px" }}>
            المؤشرات الأساسية، ثم أهم ما تكشفه البيانات والإجراءات المقترحة.
          </p>
          <Kpis items={kpis} compact />
          {h && (
            <Card
              style={{ display: "flex", alignItems: "center", gap: 10, padding: 10, marginTop: 12 }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: SCORE_COLOR[severity],
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12.5 }}>
                {severity === "good"
                  ? "جودة البيانات جيدة"
                  : severity === "warn"
                    ? "جودة البيانات مقبولة مع تحفّظات"
                    : "جودة البيانات تحتاج معالجة"}
                {" · "}
                <span
                  style={{
                    color: SCORE_COLOR[severity],
                    fontFamily: '"IBM Plex Mono", "Changa", monospace',
                  }}
                >
                  {h.score}%
                </span>
              </span>
            </Card>
          )}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
            <SectionTitle>الاستنتاج الذهبي</SectionTitle>
            <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
              {headlines.map((hl, i) => (
                <Card key={i} style={{ padding: 12 }}>
                  <p dir="auto" style={{ margin: 0, fontSize: 12, color: TEAL, fontWeight: 600 }}>
                    {i + 1}. {hl.title}
                  </p>
                  <p dir="auto" style={{ margin: "5px 0 0", fontSize: 13.5, lineHeight: 1.75 }}>
                    {hl.line}
                  </p>
                </Card>
              ))}
            </div>
          </div>
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${LINE}` }}>
            <SectionTitle>التوصيات السريعة</SectionTitle>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: actions.length > 1 ? "1fr 1fr" : "1fr",
                gap: 8,
                marginTop: 10,
              }}
            >
              {(["immediate", "growth", "risk"] as ActionBucket[]).map((bucket) => {
                const items = actions.filter((item) => item.bucket === bucket);
                if (items.length === 0) return null;
                return (
                  <Card
                    key={bucket}
                    style={{ padding: 10, borderInlineStart: `3px solid ${BUCKET_COLOR[bucket]}` }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: BUCKET_COLOR[bucket],
                        fontWeight: 700,
                      }}
                    >
                      {BUCKET_LABEL[bucket]}
                    </p>
                    <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                      {items.map((item, i) => (
                        <div key={i}>
                          <p dir="auto" style={{ margin: 0, fontSize: 11.5, fontWeight: 600 }}>
                            {item.title}
                          </p>
                          <p
                            dir="auto"
                            style={{
                              margin: "2px 0 0",
                              fontSize: 10.8,
                              lineHeight: 1.6,
                              color: MUTED,
                            }}
                          >
                            {item.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </Page>
      )}

      {/* نظرة عامة: ملخص تلقائي مبني على الأدلة */}
      {overview && (
        <Page index={++page} total={total} title="نظرة عامة">
          <SectionTitle>نظرة عامة</SectionTitle>
          <p dir="auto" style={{ margin: "0 0 18px", fontSize: 15, lineHeight: 1.9 }}>
            {overview.snapshot}
          </p>
          {overview.findings.length > 0 && (
            <>
              <h3 style={{ margin: "6px 0 10px", fontSize: 15, color: TEAL }}>
                أبرز ما كشفه التحليل
              </h3>
              <div style={{ display: "grid", gap: 10 }}>
                {overview.findings.map((f) => (
                  <Card key={f.title} style={{ padding: 14 }}>
                    <p dir="auto" style={{ margin: 0, fontSize: 13, color: MUTED }}>
                      {f.title}
                    </p>
                    <p dir="auto" style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.8 }}>
                      {f.line}
                    </p>
                  </Card>
                ))}
              </div>
            </>
          )}
          {overview.cautions.length > 0 && (
            <>
              <h3 style={{ margin: "22px 0 10px", fontSize: 15, color: SCORE_COLOR.warn }}>
                تحفّظات قبل الاعتماد على الأرقام
              </h3>
              <ul
                style={{
                  margin: 0,
                  paddingInlineStart: 20,
                  display: "grid",
                  gap: 6,
                  fontSize: 13.5,
                  lineHeight: 1.8,
                }}
              >
                {overview.cautions.map((c) => (
                  <li key={c} dir="auto">
                    {c}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p style={{ margin: "22px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
            كل رقم في هذا التقرير محسوب محلياً على الملف نفسه، ومسنود بالاستعلام المنفَّذ والنتيجة
            المعروضة.
          </p>
        </Page>
      )}

      {/* كروت المؤشرات الرئيسية */}
      {s.kpi && !combineKpiAndSummary && (
        <Page index={++page} total={total} title="المؤشرات الرئيسية">
          <SectionTitle>المؤشرات الرئيسية</SectionTitle>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 18px" }}>
            أهم الأرقام المستخلصة من الملف — للاطّلاع السريع قبل التفاصيل.
          </p>
          <Kpis items={kpis} big={data.audience === "executive"} />
          {h && (
            <div style={{ marginTop: 18 }}>
              <Card style={{ display: "flex", alignItems: "center", gap: 14, padding: 16 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 999,
                    background: SCORE_COLOR[severity],
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 15 }}>
                  {severity === "good"
                    ? "بيانات موثوقة"
                    : severity === "warn"
                      ? "بيانات مقبولة مع تحفّظات"
                      : "بيانات تحتاج معالجة قبل القرار"}{" "}
                  بنسبة{" "}
                  <span
                    style={{
                      color: SCORE_COLOR[severity],
                      fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace',
                    }}
                  >
                    {h.score}%
                  </span>
                </span>
              </Card>
            </div>
          )}
        </Page>
      )}

      {/* الاستنتاج والتوصيات — صفحة واحدة إذا كان المحتوى قصيراً */}
      {combineSummary && !combineKpiAndSummary && (
        <Page index={++page} total={total} title="الاستنتاجات والتوصيات">
          <SectionTitle>الاستنتاج الذهبي</SectionTitle>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 14px" }}>
            جملة واحدة تختصر كل محور تحليلي.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {headlines.map((hl, i) => (
              <Card key={i} style={{ padding: 14 }}>
                <p dir="auto" style={{ margin: 0, fontSize: 12.5, color: TEAL, fontWeight: 600 }}>
                  {i + 1}. {hl.title}
                </p>
                <p dir="auto" style={{ margin: "7px 0 0", fontSize: 15, lineHeight: 1.8 }}>
                  {hl.line}
                </p>
              </Card>
            ))}
          </div>
          <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${LINE}` }}>
            <SectionTitle>مصفوفة التوصيات السريعة</SectionTitle>
            <p style={{ color: MUTED, fontSize: 13, margin: "0 0 12px" }}>
              توصيات مصنّفة حسب نوع الإجراء المطلوب.
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: actions.length > 1 ? "1fr 1fr" : "1fr",
                gap: 10,
              }}
            >
              {(["immediate", "growth", "risk"] as ActionBucket[]).map((bucket) => {
                const items = actions.filter((item) => item.bucket === bucket);
                if (items.length === 0) return null;
                return (
                  <Card
                    key={bucket}
                    style={{ padding: 12, borderInlineStart: `4px solid ${BUCKET_COLOR[bucket]}` }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 13,
                        fontWeight: 700,
                        color: BUCKET_COLOR[bucket],
                      }}
                    >
                      {BUCKET_LABEL[bucket]}
                    </p>
                    <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                      {items.map((item, i) => (
                        <div key={i}>
                          <p dir="auto" style={{ margin: 0, fontSize: 12.5, fontWeight: 600 }}>
                            {item.title}
                          </p>
                          <p
                            dir="auto"
                            style={{
                              margin: "3px 0 0",
                              fontSize: 11.5,
                              lineHeight: 1.75,
                              color: MUTED,
                            }}
                          >
                            {item.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </Page>
      )}

      {/* الاستنتاج الذهبي — صفحة مستقلة للمحتوى الأطول */}
      {headlines.length > 0 && !combineSummary && (
        <Page index={++page} total={total} title="الاستنتاج الذهبي">
          <SectionTitle>الاستنتاج الذهبي</SectionTitle>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 18px" }}>
            جملة واحدة تختصر كل محور تحليلي.
          </p>
          <div style={{ display: "grid", gap: 12 }}>
            {headlines.map((hl, i) => (
              <Card key={i} style={{ padding: 16 }}>
                <p dir="auto" style={{ margin: 0, fontSize: 12.5, color: TEAL, fontWeight: 600 }}>
                  {i + 1}. {hl.title}
                </p>
                <p dir="auto" style={{ margin: "8px 0 0", fontSize: 16, lineHeight: 1.9 }}>
                  {hl.line}
                </p>
              </Card>
            ))}
          </div>
        </Page>
      )}

      {/* مصفوفة التوصيات — صفحة مستقلة للمحتوى الأطول */}
      {actions.length > 0 && !combineSummary && (
        <Page index={++page} total={total} title="مصفوفة التوصيات">
          <SectionTitle>مصفوفة التوصيات السريعة</SectionTitle>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 18px" }}>
            توصيات مصنّفة حسب نوع الإجراء المطلوب.
          </p>
          <div style={{ display: "grid", gap: 14 }}>
            {(["immediate", "growth", "risk"] as ActionBucket[]).map((bucket) => {
              const items = actions.filter((item) => item.bucket === bucket);
              if (items.length === 0) return null;
              return (
                <Card
                  key={bucket}
                  style={{ padding: 16, borderInlineStart: `4px solid ${BUCKET_COLOR[bucket]}` }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 14,
                      fontWeight: 700,
                      color: BUCKET_COLOR[bucket],
                    }}
                  >
                    {BUCKET_LABEL[bucket]}
                  </p>
                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    {items.map((item, i) => (
                      <div key={i}>
                        <p dir="auto" style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                          {item.title}
                        </p>
                        <p
                          dir="auto"
                          style={{
                            margin: "4px 0 0",
                            fontSize: 12.5,
                            lineHeight: 1.9,
                            color: MUTED,
                          }}
                        >
                          {item.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </Page>
      )}

      {/* صفحة جودة موحّدة للمصادر الصغيرة */}
      {combineQualitySections && h && (
        <Page index={++page} total={total} title="جودة البيانات">
          <SectionTitle>صحة البيانات والأعمدة</SectionTitle>
          <p style={{ color: MUTED, fontSize: 12, margin: "0 0 12px" }}>
            تقييم الجودة، تفاصيل الأعمدة، والحدود الرقمية في لوحة واحدة.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "150px 1fr",
              gap: 10,
              alignItems: "stretch",
            }}
          >
            <Card
              style={{
                textAlign: "center",
                padding: 10,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: 11, color: MUTED }}>درجة الجودة</p>
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 42,
                  fontWeight: 700,
                  lineHeight: 1.1,
                  color: SCORE_COLOR[severity],
                  fontFamily: '"IBM Plex Mono", "Changa", monospace',
                }}
              >
                {h.score}
              </p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: MUTED }}>من 100</p>
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                ["عدد الصفوف", num(data.rowCount)],
                ["عدد الأعمدة", num(data.columnCount)],
                ["الخلايا المفقودة", num(h.missingCells)],
                ["الصفوف المكررة", num(h.duplicateRows)],
              ].map(([label, value]) => (
                <Card key={label} style={{ padding: 9 }}>
                  <p style={{ margin: 0, fontSize: 10.5, color: MUTED }}>{label}</p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: 17,
                      fontWeight: 700,
                      fontFamily: '"IBM Plex Mono", "Changa", monospace',
                    }}
                  >
                    {value}
                  </p>
                </Card>
              ))}
            </div>
          </div>
          <div
            style={{
              marginTop: 10,
              padding: "9px 12px",
              border: `1px solid ${LINE}`,
              borderRadius: 12,
            }}
          >
            <p style={{ margin: 0, fontSize: 11.5, lineHeight: 1.7 }}>
              {h.issues.length > 0
                ? `اكتشف الفحص ${num(h.issues.length)} مشكلة؛ أبرزها: ${h.issues
                    .slice(0, 3)
                    .map((issue) => issue.title)
                    .join(" — ")}.`
                : "لم يكتشف الفحص مشاكل مؤثرة في جودة البيانات."}{" "}
              {data.cleanSteps.length > 0
                ? `طُبِّقت ${num(data.cleanSteps.length)} عملية تنظيف غير تدميرية.`
                : "لم تُطبَّق عمليات تنظيف على البيانات."}
              {estimatedValuesNote(data.cleanSteps)
                ? ` ${estimatedValuesNote(data.cleanSteps)}`
                : ""}
            </p>
          </div>
          {h.issues.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
              {h.issues.slice(0, 4).map((issue) => (
                <div
                  key={issue.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 6,
                    border: `1px solid ${LINE}`,
                    borderRadius: 9,
                    padding: "5px 8px",
                    fontSize: 10.5,
                  }}
                >
                  <span style={{ flex: 1 }}>{issue.title}</span>
                  <span
                    style={{
                      color: SCORE_COLOR[issue.severity],
                      fontFamily: '"IBM Plex Mono", "Changa", monospace',
                    }}
                  >
                    {num(issue.affectedRows)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            <SectionTitle>سجل صحة الأعمدة</SectionTitle>
            <div
              style={{
                border: `1px solid ${LINE}`,
                borderRadius: 11,
                overflow: "hidden",
                marginTop: 7,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.45fr 0.85fr 0.65fr 0.65fr 0.7fr 0.7fr",
                  gap: 5,
                  padding: "7px 8px",
                  background: CARD,
                  color: MUTED,
                  fontSize: 9.5,
                }}
              >
                <span>العمود</span>
                <span>النوع</span>
                <span>المفقود</span>
                <span>النسبة</span>
                <span>فريد</span>
                <span>تعارض</span>
              </div>
              {h.columns.map((column, i) => (
                <div
                  key={column.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.45fr 0.85fr 0.65fr 0.65fr 0.7fr 0.7fr",
                    gap: 5,
                    padding: "6px 8px",
                    borderTop: `1px solid ${LINE}`,
                    background:
                      i % 2
                        ? ACTIVE.dark
                          ? "rgba(238,242,247,0.04)"
                          : "rgba(32,49,58,0.035)"
                        : "transparent",
                    fontSize: 9.5,
                  }}
                >
                  <span
                    dir="auto"
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {column.name}
                  </span>
                  <span
                    dir="ltr"
                    style={{
                      fontFamily: '"IBM Plex Mono", "Changa", monospace',
                      color: MUTED,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {column.type}
                  </span>
                  <span style={{ fontFamily: '"IBM Plex Mono", "Changa", monospace' }}>
                    {num(column.nullCount)}
                  </span>
                  <span
                    style={{
                      fontFamily: '"IBM Plex Mono", "Changa", monospace',
                      color: column.nullRatio > 0.1 ? SCORE_COLOR.bad : MUTED,
                    }}
                  >
                    {(column.nullRatio * 100).toFixed(1)}%
                  </span>
                  <span style={{ fontFamily: '"IBM Plex Mono", "Changa", monospace' }}>
                    {num(column.distinctCount)}
                  </span>
                  <span
                    style={{
                      fontFamily: '"IBM Plex Mono", "Changa", monospace',
                      color: column.typeMismatchCount > 0 ? SCORE_COLOR.warn : MUTED,
                    }}
                  >
                    {num(column.typeMismatchCount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {s.stats && numericHealthColumns.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <SectionTitle>الحدود الإحصائية للأعمدة الرقمية</SectionTitle>
              <div
                style={{
                  border: `1px solid ${LINE}`,
                  borderRadius: 11,
                  overflow: "hidden",
                  marginTop: 7,
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.4fr 1fr 1fr 1fr 0.8fr",
                    gap: 5,
                    padding: "7px 8px",
                    background: CARD,
                    color: MUTED,
                    fontSize: 9.5,
                  }}
                >
                  <span>العمود</span>
                  <span>أدنى قيمة</span>
                  <span>الوسيط</span>
                  <span>أعلى قيمة</span>
                  <span>النقص</span>
                </div>
                {numericHealthColumns.map((column, i) => (
                  <div
                    key={column.name}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 1fr 1fr 1fr 0.8fr",
                      gap: 5,
                      padding: "6px 8px",
                      borderTop: `1px solid ${LINE}`,
                      background:
                        i % 2
                          ? ACTIVE.dark
                            ? "rgba(238,242,247,0.04)"
                            : "rgba(32,49,58,0.035)"
                          : "transparent",
                      fontSize: 9.5,
                    }}
                  >
                    <span
                      dir="auto"
                      style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {column.name}
                    </span>
                    <span style={{ fontFamily: '"IBM Plex Mono", "Changa", monospace' }}>
                      {column.min === null ? "—" : fmt(column.min)}
                    </span>
                    <span style={{ fontFamily: '"IBM Plex Mono", "Changa", monospace' }}>
                      {column.median === null ? "—" : fmt(column.median)}
                    </span>
                    <span style={{ fontFamily: '"IBM Plex Mono", "Changa", monospace' }}>
                      {column.max === null ? "—" : fmt(column.max)}
                    </span>
                    <span style={{ fontFamily: '"IBM Plex Mono", "Changa", monospace' }}>
                      {(column.nullRatio * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <p style={{ margin: "9px 0 0", color: MUTED, fontSize: 10.5, lineHeight: 1.65 }}>
            القيم المفقودة الإجمالية {(h.missingRatio * 100).toFixed(1)}%، والصفوف المكررة{" "}
            {num(h.duplicateRows)}. تُقرأ هذه المؤشرات مع نوع كل عمود وسياق التحليل قبل اتخاذ
            القرار.
          </p>
        </Page>
      )}

      {/* ملخص جودة البيانات */}
      {s.health && !combineQualitySections && (
        <Page index={++page} total={total} title="ملخص جودة البيانات">
          <SectionTitle>ملخص جودة البيانات</SectionTitle>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 20px" }}>
            محسوبة بأوزان ثابتة عبر استعلامات SQL على محرك DuckDB — بدون ذكاء اصطناعي.
          </p>
          <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
            <Card
              style={{
                width: 230,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <p style={{ margin: 0, fontSize: 13, color: MUTED }}>درجة جودة البيانات</p>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 76,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: h ? SCORE_COLOR[severity] : MUTED,
                  fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace',
                }}
              >
                {h ? h.score : "—"}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: MUTED }}>من 100</p>
            </Card>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                ["عدد الصفوف", num(data.rowCount)],
                ["عدد الأعمدة", num(data.columnCount)],
                ["الخلايا المفقودة", h ? num(h.missingCells) : "—"],
                ["الصفوف المكررة", h ? num(h.duplicateRows) : "—"],
              ].map(([label, value]) => (
                <Card key={label} style={{ padding: 14 }}>
                  <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{label}</p>
                  <p
                    style={{
                      margin: "6px 0 0",
                      fontSize: 24,
                      fontWeight: 700,
                      fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace',
                    }}
                  >
                    {value}
                  </p>
                </Card>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <Card>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 2 }}>
                {h && h.issues.length > 0
                  ? `اكتشف الفحص ${num(h.issues.length)} مشكلة في جودة البيانات، أبرزها: ${h.issues
                      .slice(0, 3)
                      .map((i) => i.title)
                      .join(" — ")}.`
                  : "لم يكتشف الفحص مشاكل مؤثرة في جودة البيانات."}
              </p>
              <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 2, color: MUTED }}>
                {data.cleanSteps.length > 0
                  ? `طُبِّقت ${num(data.cleanSteps.length)} عملية تنظيف غير تدميرية على نسخة العرض، والأرقام أعلاه تعكس الحالة بعد التنظيف.`
                  : "لم تُطبَّق أي عملية تنظيف على البيانات، والأرقام أعلاه تمثّل الحالة الأصلية للملف."}
                {estimatedValuesNote(data.cleanSteps)
                  ? ` ${estimatedValuesNote(data.cleanSteps)}`
                  : ""}
              </p>
            </Card>
          </div>

          {h && h.issues.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>أبرز المشاكل حسب الخطورة</h3>
              <div style={{ display: "grid", gap: 8 }}>
                {h.issues.slice(0, 5).map((i) => (
                  <div
                    key={i.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      border: `1px solid ${LINE}`,
                      borderRadius: 12,
                      padding: "10px 14px",
                      fontSize: 13,
                    }}
                  >
                    <span style={{ flex: 1 }}>{i.title}</span>
                    <span
                      style={{
                        color: SCORE_COLOR[i.severity],
                        fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace',
                        whiteSpace: "nowrap",
                      }}
                    >
                      {num(i.affectedRows)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Page>
      )}

      {/* سجل جودة البيانات التفصيلي (عمود بعمود) */}
      {!combineQualitySections &&
        healthLogPages.map((cols, pi) => (
          <Page key={`log-${pi}`} index={++page} total={total} title={`سجل الجودة ${pi + 1}`}>
            <SectionTitle>سجل جودة البيانات التفصيلي</SectionTitle>
            <p style={{ color: MUTED, fontSize: 13, margin: "0 0 16px" }}>
              كل عمود بالعدد والنسبة المئوية — للتدقيق والتحقق ({pi + 1} من {healthLogPages.length}
              ).
            </p>
            <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.5fr 0.9fr 0.8fr 0.7fr 0.8fr 0.8fr",
                  background: CARD,
                  fontSize: 11.5,
                  color: MUTED,
                  padding: "10px 12px",
                  gap: 8,
                }}
              >
                <span>العمود</span>
                <span>النوع</span>
                <span>المفقود</span>
                <span>النسبة</span>
                <span>قيم فريدة</span>
                <span>نوع مخالف</span>
              </div>
              {cols.map((c, i) => (
                <div
                  key={c.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 0.9fr 0.8fr 0.7fr 0.8fr 0.8fr",
                    fontSize: 11.5,
                    padding: "9px 12px",
                    gap: 8,
                    borderTop: `1px solid ${LINE}`,
                    background:
                      i % 2
                        ? ACTIVE.dark
                          ? "rgba(238,242,247,0.04)"
                          : "rgba(32,49,58,0.035)"
                        : "transparent",
                  }}
                >
                  <span
                    dir="auto"
                    style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                  >
                    {c.name}
                  </span>
                  <span
                    dir="ltr"
                    style={{
                      fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace',
                      color: MUTED,
                    }}
                  >
                    {c.type}
                  </span>
                  <span style={{ fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace' }}>
                    {num(c.nullCount)}
                  </span>
                  <span
                    style={{
                      fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace',
                      color:
                        c.nullRatio > 0.1
                          ? SCORE_COLOR.bad
                          : c.nullRatio > 0.02
                            ? SCORE_COLOR.warn
                            : MUTED,
                    }}
                  >
                    {(c.nullRatio * 100).toFixed(1)}%
                  </span>
                  <span
                    style={{
                      fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace',
                      color: MUTED,
                    }}
                  >
                    {num(c.distinctCount)}
                  </span>
                  <span
                    style={{
                      fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace',
                      color: c.typeMismatchCount > 0 ? SCORE_COLOR.warn : MUTED,
                    }}
                  >
                    {num(c.typeMismatchCount)}
                  </span>
                </div>
              ))}
            </div>
          </Page>
        ))}

      {/* الحدود الإحصائية */}
      {s.stats && h && numericHealthColumns.length > 0 && !combineQualitySections && (
        <Page
          index={++page}
          total={total}
          title={combineAlertsWithStats ? "الحدود الإحصائية والتنبيهات" : "الحدود الإحصائية"}
        >
          <SectionTitle>تحليل الفروقات والحدود الإحصائية</SectionTitle>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 16px" }}>
            القيم الحدّية والوسيط لكل عمود رقمي، وأثر القيم المفقودة على دقة النتائج.
          </p>
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 14, overflow: "hidden" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr",
                background: CARD,
                fontSize: 11.5,
                color: MUTED,
                padding: "10px 12px",
                gap: 8,
              }}
            >
              <span>العمود الرقمي</span>
              <span>أدنى قيمة</span>
              <span>الوسيط</span>
              <span>أعلى قيمة</span>
              <span>أثر النقص</span>
            </div>
            {numericHealthColumns.map((c, i) => (
              <div
                key={c.name}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr",
                  fontSize: 11.5,
                  padding: "9px 12px",
                  gap: 8,
                  borderTop: `1px solid ${LINE}`,
                  background:
                    i % 2
                      ? ACTIVE.dark
                        ? "rgba(238,242,247,0.04)"
                        : "rgba(32,49,58,0.035)"
                      : "transparent",
                }}
              >
                <span
                  dir="auto"
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {c.name}
                </span>
                <span style={{ fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace' }}>
                  {c.min === null ? "—" : fmt(c.min)}
                </span>
                <span style={{ fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace' }}>
                  {c.median === null ? "—" : fmt(c.median)}
                </span>
                <span style={{ fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace' }}>
                  {c.max === null ? "—" : fmt(c.max)}
                </span>
                <span
                  style={{
                    fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace',
                    color: c.nullRatio > 0.1 ? SCORE_COLOR.warn : MUTED,
                  }}
                >
                  {(c.nullRatio * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <Card>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 2, color: MUTED }}>
                نسبة القيم المفقودة الإجمالية {(h.missingRatio * 100).toFixed(1)}% — كل عمود تتجاوز
                فيه النسبة 10% يقلّل موثوقية المتوسطات والمجاميع المحسوبة عليه، ويُنصح بتقييد
                التفسير أو معالجة النقص أولاً. الصفوف المكررة ({num(h.duplicateRows)}) قد تضخّم
                المجاميع إن لم تُزل.
              </p>
            </Card>
          </div>
          {combineAlertsWithStats && (
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LINE}` }}>
              <SectionTitle>تنبيهات تستحق المتابعة</SectionTitle>
              <div style={{ display: "grid", gap: 7, marginTop: 8 }}>
                {alerts.map((alert, i) => (
                  <Card
                    key={i}
                    style={{
                      padding: 10,
                      borderInlineStart: `3px solid ${alert.level === "bad" ? SCORE_COLOR.bad : SCORE_COLOR.warn}`,
                    }}
                  >
                    <p dir="auto" style={{ margin: 0, fontSize: 11.5, fontWeight: 600 }}>
                      {alert.title}
                    </p>
                    <p
                      dir="auto"
                      style={{ margin: "3px 0 0", fontSize: 10.5, lineHeight: 1.6, color: MUTED }}
                    >
                      {alert.detail}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </Page>
      )}

      {/* سجل التحويلات والتنظيف — لا يُنشأ إلا عند وجود خطوات فعلية */}
      {lineage.length > 0 && (
        <Page index={++page} total={total} title="سجل التحويلات">
          <SectionTitle>سجل التحويلات والتنظيف (Audit Trail)</SectionTitle>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 16px" }}>
            توثيق كل خطوة طُبِّقت على الملف الخام — التنظيف غير تدميري ويُنفَّذ عبر VIEW في DuckDB.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            {lineage.map((item) => (
              <Card
                key={item.order}
                style={{ padding: 14, display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                <span
                  style={{
                    fontFamily: '"IBM Plex Mono", "Changa", monospace',
                    color: TEAL,
                    fontSize: 13,
                    flexShrink: 0,
                  }}
                >
                  {String(item.order).padStart(2, "0")}
                </span>
                <span style={{ flex: 1 }}>
                  <p dir="auto" style={{ margin: 0, fontSize: 13.5 }}>
                    {item.label}
                  </p>
                  <p dir="auto" style={{ margin: "4px 0 0", fontSize: 11.5, color: MUTED }}>
                    {item.detail}
                  </p>
                </span>
              </Card>
            ))}
          </div>
        </Page>
      )}

      {/* SQL lineage evidence — separate from the cleaning transformation log. */}
      {sqlLineagePages.map((items, pageIndex) => (
        <Page
          key={`sql-lineage-${pageIndex}`}
          index={++page}
          total={total}
          title={`مسارات اشتقاق SQL ${pageIndex + 1}`}
        >
          <SectionTitle>مسارات اشتقاق SQL (SQL Lineage)</SectionTitle>
          <p style={{ color: MUTED, fontSize: 11.5, margin: "0 0 12px", lineHeight: 1.7 }}>
            اعتماديات الأعمدة المرصودة من استعلامات الاستنتاجات المثبّتة. تُعرض مصادر القيمة وشروط
            CASE واعتماديات عضوية الصفوف بصورة منفصلة.
          </p>
          <div style={{ display: "grid", gap: 9 }}>
            {items.map((item, index) => (
              <Card
                key={`${item.insightTitle}-${item.outputName}-${index}`}
                style={{ padding: 10 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <p
                      dir="auto"
                      style={{ margin: 0, fontSize: 11.5, color: TEAL, fontWeight: 700 }}
                    >
                      {item.outputName}
                    </p>
                    <p dir="auto" style={{ margin: "2px 0 0", fontSize: 9.5, color: MUTED }}>
                      {item.insightTitle} · المصدر: {item.sourceTable}
                    </p>
                  </div>
                  <span style={{ flexShrink: 0, fontSize: 9, color: MUTED }}>
                    {item.role} · {item.confidence}
                  </span>
                </div>
                <pre
                  dir="ltr"
                  style={{
                    margin: "5px 0",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    textAlign: "left",
                    fontFamily: '"IBM Plex Mono", monospace',
                    fontSize: 9,
                    lineHeight: 1.45,
                    color: TEXT,
                  }}
                >
                  {item.expression}
                </pre>
                {item.valueDependencies.length === 0 &&
                  item.conditionDependencies.length === 0 &&
                  item.rowFilterDependencies.length === 0 &&
                  item.sourceDependencies.length > 0 && (
                    <div
                      style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 4 }}
                    >
                      <span style={{ width: 112, flexShrink: 0, fontSize: 9, color: MUTED }}>
                        الاعتماديات المرصودة
                      </span>
                      <span
                        dir="ltr"
                        style={{
                          flex: 1,
                          fontFamily: '"IBM Plex Mono", monospace',
                          fontSize: 9,
                          color: TEXT,
                          wordBreak: "break-word",
                        }}
                      >
                        {item.sourceDependencies.join(" · ")}
                      </span>
                    </div>
                  )}
                {(
                  [
                    ["مصادر القيمة", item.valueDependencies],
                    ["شروط CASE", item.conditionDependencies],
                    ["اعتماديات عضوية الصفوف", item.rowFilterDependencies],
                  ] as const
                ).map(([label, dependencies]) =>
                  dependencies.length > 0 ? (
                    <div
                      key={label}
                      style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 4 }}
                    >
                      <span style={{ width: 112, flexShrink: 0, fontSize: 9, color: MUTED }}>
                        {label}
                      </span>
                      <span
                        dir="ltr"
                        style={{
                          flex: 1,
                          fontFamily: '"IBM Plex Mono", monospace',
                          fontSize: 9,
                          color: TEXT,
                          wordBreak: "break-word",
                        }}
                      >
                        {dependencies.join(" · ")}
                      </span>
                    </div>
                  ) : null,
                )}
                {item.operations.length > 0 && (
                  <p style={{ margin: "5px 0 0", fontSize: 9, color: MUTED }}>
                    العمليات: {item.operations.join("، ")}
                  </p>
                )}
              </Card>
            ))}
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 9.5, lineHeight: 1.6, color: MUTED }}>
            قيد منهجي: هذا تتبّع بنيوي لاعتماديات SQL، وليس إثباتاً للسببية أو التكافؤ الدلالي أو
            صحة تعريف الأعمال أو صحة البيانات.
          </p>
        </Page>
      ))}

      {/* تجميع قوائم أفضل/أسوأ فئتين في صفحة واحدة عند قصر القائمتين */}
      {combineTopBottom && (
        <Page index={++page} total={total} title="قوائم الأفضل والأسوأ">
          <SectionTitle>مقارنة الأفضل والأسوأ</SectionTitle>
          <p style={{ color: MUTED, fontSize: 12.5, margin: "0 0 12px" }}>
            ترتيب الفئات لكل محور، مع إبقاء قائمة الأعلى والأسفل متجاورتين.
          </p>
          <div style={{ display: "grid", gap: 14 }}>
            {lists.map((list, li) => (
              <div
                key={li}
                style={{
                  paddingBottom: li === 0 ? 12 : 0,
                  borderBottom: li === 0 ? `1px solid ${LINE}` : "none",
                }}
              >
                <p
                  dir="auto"
                  style={{ margin: "0 0 8px", fontSize: 12, color: TEAL, fontWeight: 700 }}
                >
                  {list.title} — القياس:{" "}
                  <span style={{ color: TEXT, fontWeight: 500 }}>{list.metricCol}</span>
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { head: "أفضل 10", rows: list.top, color: TEAL },
                    { head: "أسوأ 10", rows: list.bottom, color: SCORE_COLOR.bad },
                  ].map((side) => (
                    <Card key={side.head} style={{ padding: 10 }}>
                      <p
                        style={{
                          margin: "0 0 7px",
                          fontSize: 11.5,
                          fontWeight: 700,
                          color: side.color,
                        }}
                      >
                        {side.head}
                      </p>
                      <div style={{ display: "grid", gap: 4 }}>
                        {side.rows.map((row, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 8,
                              fontSize: 10.5,
                              borderBottom: `1px solid ${LINE}`,
                              paddingBottom: 3,
                            }}
                          >
                            <span
                              dir={dirOf(cleanCell(row.label))}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                unicodeBidi: "isolate",
                              }}
                            >
                              {i + 1}. {cleanCell(row.label)}
                            </span>
                            <span
                              style={{
                                fontFamily: '"IBM Plex Mono", "Changa", monospace',
                                color: side.color,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {fmt(row.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Page>
      )}

      {/* دمج قائمة ترتيب واحدة مع استنتاجها عندما تكون البيانات مختصرة */}
      {combineRankingWithSingleInsight && (
        <Page index={++page} total={total} title="الترتيب والاستنتاج">
          <SectionTitle>مقارنة الأفضل والأسوأ</SectionTitle>
          <p dir="auto" style={{ color: MUTED, fontSize: 11.5, margin: "0 0 8px" }}>
            {lists[0]!.title} — القياس: <span style={{ color: TEXT }}>{lists[0]!.metricCol}</span>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { head: "أفضل الفئات", rows: lists[0]!.top, color: TEAL },
              { head: "أضعف الفئات", rows: lists[0]!.bottom, color: SCORE_COLOR.bad },
            ].map((side) => (
              <Card key={side.head} style={{ padding: 9 }}>
                <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, color: side.color }}>
                  {side.head}
                </p>
                <div style={{ display: "grid", gap: 3 }}>
                  {side.rows.map((row, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 7,
                        fontSize: 10,
                        borderBottom: `1px solid ${LINE}`,
                        paddingBottom: 2,
                      }}
                    >
                      <span
                        dir={dirOf(cleanCell(row.label))}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          unicodeBidi: "isolate",
                        }}
                      >
                        {i + 1}. {cleanCell(row.label)}
                      </span>
                      <span
                        style={{
                          fontFamily: '"IBM Plex Mono", "Changa", monospace',
                          color: side.color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fmt(row.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
          <div style={{ marginTop: 13, paddingTop: 11, borderTop: `1px solid ${LINE}` }}>
            <SectionTitle>الاستنتاج التحليلي</SectionTitle>
            <h3
              dir="auto"
              style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.6, margin: "7px 0 8px" }}
            >
              {insights[0]!.evidence.title}
            </h3>
            {insights[0]!.plan.intro_ar?.trim() && (
              <p
                dir="auto"
                style={{ margin: "0 0 9px", fontSize: 11.5, lineHeight: 1.65, color: MUTED }}
              >
                {insights[0]!.plan.intro_ar.trim()}
              </p>
            )}
            {insights[0]!.evidence.highlights.length > 0 && (
              <div
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}
              >
                {insights[0]!.evidence.highlights.map((item, i) => (
                  <Card key={i} style={{ padding: 8 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 21,
                        fontWeight: 700,
                        color: TEAL,
                        fontFamily: '"IBM Plex Mono", "Changa", monospace',
                      }}
                    >
                      {item.value}
                    </p>
                    <p dir="auto" style={{ margin: "3px 0 0", fontSize: 10.5, color: MUTED }}>
                      {item.label}
                    </p>
                  </Card>
                ))}
              </div>
            )}
            <ReportChart plan={insights[0]!.plan} rows={insights[0]!.rows} height={220} />
            {insights[0]!.plan.analysis_ar?.trim() && (
              <p
                dir="auto"
                style={{ margin: "8px 0 0", fontSize: 11.5, lineHeight: 1.65, color: MUTED }}
              >
                {insights[0]!.plan.analysis_ar.trim()}
              </p>
            )}
            {data.aiNarratedIds?.includes(insights[0]!.evidence.id) && <AiNarrationBadge />}
          </div>
        </Page>
      )}

      {/* قوائم التوب والفلوب */}
      {!combineTopBottom &&
        !combineRankingWithSingleInsight &&
        lists.map((list, li) => (
          <Page key={`tb-${li}`} index={++page} total={total} title={`توب وفلوب ${li + 1}`}>
            <SectionTitle>قوائم الأفضل والأسوأ</SectionTitle>
            <p dir="auto" style={{ color: MUTED, fontSize: 13, margin: "0 0 16px" }}>
              {list.title} — القياس:{" "}
              <span dir="auto" style={{ color: TEXT }}>
                {list.metricCol}
              </span>
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { head: "أفضل 10", rows: list.top, color: TEAL },
                { head: "أسوأ 10", rows: list.bottom, color: SCORE_COLOR.bad },
              ].map((side) => (
                <Card key={side.head} style={{ padding: 14 }}>
                  <p
                    style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: side.color }}
                  >
                    {side.head}
                  </p>
                  <div style={{ display: "grid", gap: 6 }}>
                    {side.rows.map((r, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          fontSize: 12,
                          borderBottom: `1px solid ${LINE}`,
                          paddingBottom: 5,
                        }}
                      >
                        <span
                          dir={dirOf(cleanCell(r.label))}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            unicodeBidi: "isolate",
                          }}
                        >
                          {i + 1}. {cleanCell(r.label)}
                        </span>
                        <span
                          style={{
                            fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace',
                            color: side.color,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {fmt(r.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </Page>
        ))}

      {/* تنبيهات الانحراف */}
      {alerts.length > 0 &&
        !combineAlertsWithStats &&
        !combineAlertsWithMethodology &&
        !combineAlertsWithSql && (
          <Page index={++page} total={total} title="تنبيهات الانحراف">
            <SectionTitle>تنبيهات الانحراف</SectionTitle>
            <p style={{ color: MUTED, fontSize: 13, margin: "0 0 16px" }}>
              قيم تبتعد عن المتوسط بأكثر من انحرافين معياريين، ومشاكل جودة حادة تستدعي المتابعة.
            </p>
            <div style={{ display: "grid", gap: 10 }}>
              {alerts.map((a, i) => (
                <Card
                  key={i}
                  style={{
                    padding: 14,
                    borderInlineStart: `4px solid ${a.level === "bad" ? SCORE_COLOR.bad : SCORE_COLOR.warn}`,
                  }}
                >
                  <p dir="auto" style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>
                    {a.title}
                  </p>
                  <p
                    dir="auto"
                    style={{ margin: "5px 0 0", fontSize: 12.5, lineHeight: 1.9, color: MUTED }}
                  >
                    {a.detail}
                  </p>
                </Card>
              ))}
            </div>
          </Page>
        )}

      {/* صفحات الاستنتاجات */}
      {s.insights &&
        !combineRankingWithSingleInsight &&
        insights.map((ins, idx) => (
          <Page
            key={ins.evidence.id}
            index={++page}
            total={total}
            title={`الاستنتاج ${idx + 1}`}
            tocLabel={`${idx + 1}. ${ins.evidence.title}`}
          >
            <SectionTitle>{`الاستنتاج ${idx + 1} من ${insights.length}`}</SectionTitle>
            <h3
              dir="auto"
              style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.8, margin: "14px 0 16px" }}
            >
              {ins.evidence.title}
            </h3>

            {ins.plan.intro_ar?.trim() && (
              <p
                dir="auto"
                style={{ margin: "0 0 16px", fontSize: 14.5, lineHeight: 2, color: TEXT }}
              >
                {ins.plan.intro_ar.trim()}
              </p>
            )}

            {ins.evidence.highlights.length > 0 && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                {ins.evidence.highlights.map((m, i) => (
                  <Card key={i} style={{ padding: 14 }}>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 30,
                        fontWeight: 700,
                        color: TEAL,
                        fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace',
                      }}
                    >
                      {m.value}
                    </p>
                    <p dir="auto" style={{ margin: "6px 0 0", fontSize: 12, color: MUTED }}>
                      {m.label}
                    </p>
                  </Card>
                ))}
              </div>
            )}

            <ReportChart plan={ins.plan} rows={ins.rows} height={260} />

            {ins.plan.analysis_ar?.trim() && (
              <p
                dir="auto"
                style={{ margin: "16px 0 0", fontSize: 13.5, lineHeight: 2, color: MUTED }}
              >
                {ins.plan.analysis_ar.trim()}
              </p>
            )}
            {data.aiNarratedIds?.includes(ins.evidence.id) && <AiNarrationBadge />}
          </Page>
        ))}

      {/* شجرة استعلامات SQL والمنهجية */}
      {sqlPages.map((group, gi) => (
        <Page
          key={`sql-${gi}`}
          index={++page}
          total={total}
          title={combineSqlAndMethodology ? "استعلام SQL والمنهجية" : `استعلامات SQL ${gi + 1}`}
        >
          <SectionTitle>شجرة استعلامات SQL</SectionTitle>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 16px" }}>
            الكود الصريح المنفَّذ محلياً على DuckDB لكل رسم بياني — قابل للتدقيق وإعادة التنفيذ.
          </p>
          <div style={{ display: "grid", gap: 14 }}>
            {group.map((ins) => (
              <Card key={ins.evidence.id} style={{ padding: 14 }}>
                <p dir="auto" style={{ margin: 0, fontSize: 13, fontWeight: 600, color: TEAL }}>
                  {ins.evidence.title}
                </p>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 6,
                    margin: combineSqlAndMethodology ? "6px 0" : "10px 0",
                    fontSize: combineSqlAndMethodology ? 9.5 : 11,
                    color: MUTED,
                  }}
                >
                  <span
                    style={{ border: `1px solid ${LINE}`, borderRadius: 9, padding: "4px 9px" }}
                  >
                    الصفوف الداخلة:{" "}
                    <span
                      style={{ color: TEXT, fontFamily: '"IBM Plex Mono", "Changa", monospace' }}
                    >
                      {ins.evidence.baseRowCount === null ? "—" : num(ins.evidence.baseRowCount)}
                    </span>
                  </span>
                  <span
                    style={{ border: `1px solid ${LINE}`, borderRadius: 9, padding: "4px 9px" }}
                  >
                    صفوف النتيجة:{" "}
                    <span
                      style={{ color: TEXT, fontFamily: '"IBM Plex Mono", "Changa", monospace' }}
                    >
                      {num(ins.evidence.resultRowCount)}
                    </span>
                  </span>
                  <span
                    style={{ border: `1px solid ${LINE}`, borderRadius: 9, padding: "4px 9px" }}
                  >
                    نوع التحليل: <span style={{ color: TEXT }}>{ins.plan.intent}</span>
                  </span>
                </div>
                <SqlBlock sql={ins.evidence.sql} compact={combineSqlAndMethodology} />
                {ins.evidence.filters.length > 0 && (
                  <p
                    dir="auto"
                    style={{
                      margin: combineSqlAndMethodology ? "5px 0 0" : "10px 0 0",
                      fontSize: combineSqlAndMethodology ? 9.5 : 11,
                      color: MUTED,
                    }}
                  >
                    الفلاتر: {ins.evidence.filters.slice(0, 4).join(" — ")}
                  </p>
                )}
                {ins.evidence.warnings.length > 0 && (
                  <p
                    dir="auto"
                    style={{
                      margin: "4px 0 0",
                      fontSize: combineSqlAndMethodology ? 9.5 : 11,
                      color: SCORE_COLOR.warn,
                    }}
                  >
                    حدود النتيجة: {ins.evidence.warnings.slice(0, 2).join(" — ")}
                  </p>
                )}
              </Card>
            ))}
          </div>
          {combineSqlAndMethodology && (
            <div style={{ marginTop: 16, paddingTop: 13, borderTop: `1px solid ${LINE}` }}>
              {combineAlertsWithSql && (
                <div style={{ marginBottom: 12 }}>
                  <SectionTitle>تنبيهات تستحق المتابعة</SectionTitle>
                  <div style={{ display: "grid", gap: 6, marginTop: 7 }}>
                    {alerts.map((alert, i) => (
                      <Card
                        key={i}
                        style={{
                          padding: 8,
                          borderInlineStart: `3px solid ${alert.level === "bad" ? SCORE_COLOR.bad : SCORE_COLOR.warn}`,
                        }}
                      >
                        <p dir="auto" style={{ margin: 0, fontSize: 10.8, fontWeight: 600 }}>
                          {alert.title}
                        </p>
                        <p
                          dir="auto"
                          style={{ margin: "3px 0 0", fontSize: 10, lineHeight: 1.5, color: MUTED }}
                        >
                          {alert.detail}
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              <SectionTitle>المنهجية والقيود</SectionTitle>
              <MethodologyContent
                compact
                showEmptyLineageNote={Boolean(s.lineage && lineage.length === 0)}
              />
            </div>
          )}
        </Page>
      ))}

      {/* المنهجية والقيود — صفحة مستقلة فقط عندما لا يمكن دمجها بأمان */}
      {s.methodology && !combineSqlAndMethodology && (
        <Page
          index={++page}
          total={total}
          title={combineAlertsWithMethodology ? "المنهجية والتنبيهات" : "المنهجية والقيود"}
        >
          {combineAlertsWithMethodology && (
            <div style={{ marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${LINE}` }}>
              <SectionTitle>تنبيهات تستحق المتابعة</SectionTitle>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {alerts.map((alert, i) => (
                  <Card
                    key={i}
                    style={{
                      padding: 10,
                      borderInlineStart: `3px solid ${alert.level === "bad" ? SCORE_COLOR.bad : SCORE_COLOR.warn}`,
                    }}
                  >
                    <p dir="auto" style={{ margin: 0, fontSize: 12, fontWeight: 600 }}>
                      {alert.title}
                    </p>
                    <p
                      dir="auto"
                      style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.7, color: MUTED }}
                    >
                      {alert.detail}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}
          <SectionTitle>المنهجية والقيود</SectionTitle>
          <MethodologyContent showEmptyLineageNote={Boolean(s.lineage && lineage.length === 0)} />
        </Page>
      )}
    </div>
  );
}

/* ============ قالب الموجز: صفحة واحدة ============ */

function BriefDocument({ data }: { data: ReportData }) {
  applyTheme(REPORT_THEMES[data.theme ?? "light"]);
  HEADER_TEXT = { left: data.fileName, right: "MIZYAi · تقرير موجز" };
  const h = data.health;
  const insights = data.insights.slice(0, 5);
  const kpis = executiveKpis(insights, h, data.rowCount, data.columnCount).slice(0, 4);
  const headlines = headlineInsights(insights).slice(0, 3);
  const actions = recommendationMatrix(insights, h, data.domain).slice(0, 3);
  const first = insights[0];
  const cautions = buildOverview(
    data.insights,
    h,
    data.rowCount,
    data.columnCount,
    data.cleanSteps,
  ).cautions.slice(0, 1);
  const severity = h ? severityOfScore(h.score) : "good";
  return (
    <div>
      <Page index={1} total={1} title="الموجز">
        <p style={{ margin: 0, fontSize: 13, color: TEAL, fontWeight: 700, letterSpacing: 1 }}>
          تقرير موجز · {arabicDate(data.date)}
        </p>
        <h1 dir="auto" style={{ margin: "4px 0 2px", fontSize: 30, lineHeight: 1.4 }}>
          {data.fileName}
        </h1>
        <p style={{ margin: "0 0 14px", fontSize: 12.5, color: MUTED }}>
          {num(data.rowCount)} صف · {num(data.columnCount)} عمود
          {h ? ` · جودة البيانات ${h.score}%` : ""}
        </p>
        {h && (
          <div
            aria-hidden
            style={{ height: 6, borderRadius: 3, background: LINE, margin: "0 0 14px" }}
          >
            <div
              style={{
                width: `${Math.max(2, Math.min(100, h.score))}%`,
                height: 6,
                borderRadius: 3,
                background: SCORE_COLOR[severity],
              }}
            />
          </div>
        )}
        {kpis.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${kpis.length}, 1fr)`,
              gap: 8,
              marginBottom: 16,
            }}
          >
            {kpis.map((k, i) => (
              <Card key={i} style={{ padding: 10 }}>
                <p style={{ margin: 0, fontSize: 10.5, color: MUTED }}>{k.label}</p>
                <p
                  dir="auto"
                  style={{
                    margin: "3px 0 0",
                    fontSize: 24,
                    fontWeight: 700,
                    lineHeight: 1.15,
                    color: i % 2 === 0 ? TEAL : VIOLET,
                    fontFamily: '"IBM Plex Mono", "Changa", "Tajawal", monospace',
                  }}
                >
                  {k.value}
                </p>
              </Card>
            ))}
          </div>
        )}
        {headlines.length > 0 && (
          <>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, color: TEAL }}>أهم الاستنتاجات</h3>
            <div style={{ display: "grid", gap: 7, marginBottom: 14 }}>
              {headlines.map((hl, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "baseline",
                    paddingBottom: 7,
                    borderBottom: `1px solid ${LINE}`,
                  }}
                >
                  <span
                    style={{
                      color: VIOLET,
                      fontWeight: 700,
                      fontSize: 15,
                      fontFamily: '"IBM Plex Mono", monospace',
                    }}
                  >
                    {i + 1}
                  </span>
                  <p dir="auto" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.75 }}>
                    <b>{hl.title}: </b>
                    {hl.line}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
        {first && (
          <div style={{ marginBottom: 14 }}>
            <p dir="auto" style={{ margin: "0 0 4px", fontSize: 12, color: MUTED }}>
              {first.evidence.title}
            </p>
            <ReportChart plan={first.plan} rows={first.rows} height={190} />
          </div>
        )}
        {actions.length > 0 && (
          <>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, color: TEAL }}>التوصيات</h3>
            <div style={{ display: "grid", gap: 6 }}>
              {actions.map((a, i) => (
                <p key={i} dir="auto" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7 }}>
                  <b style={{ color: a.bucket === "risk" ? SCORE_COLOR.bad : VIOLET }}>
                    {BUCKET_LABEL[a.bucket]} — {a.title}:{" "}
                  </b>
                  {a.text}
                </p>
              ))}
            </div>
          </>
        )}
        {cautions.length > 0 && (
          <p dir="auto" style={{ margin: "12px 0 0", fontSize: 11.5, color: MUTED }}>
            تنبيه: {cautions[0]}
          </p>
        )}
        {data.seal && (
          <p
            dir="ltr"
            style={{
              margin: "10px 0 0",
              fontSize: 10,
              color: MUTED,
              fontFamily: '"IBM Plex Mono", monospace',
            }}
          >
            SHA-256: {data.seal.shortHash}…
          </p>
        )}
      </Page>
    </div>
  );
}

/* ============ قالب السرد: قصة البيانات ============ */

function NarrativeDocument({ data }: { data: ReportData }) {
  applyTheme(REPORT_THEMES[data.theme ?? "light"]);
  HEADER_TEXT = { left: data.fileName, right: "MIZYAi · قصة البيانات" };
  const h = data.health;
  const insights = data.insights.slice(0, 5);
  const overview = buildOverview(
    data.insights,
    h,
    data.rowCount,
    data.columnCount,
    data.cleanSteps,
  );
  const headlines = headlineInsights(insights);
  const actions = recommendationMatrix(insights, h, data.domain);
  const total = 2 + insights.length;
  let page = 0;
  return (
    <div>
      <Page index={++page} total={total} footer={false} title="الغلاف" variant="cover">
        <div
          style={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 22,
          }}
        >
          <BrandSignature />
          <p style={{ margin: 0, fontSize: 18, color: COVER_ACCENT, fontWeight: 700 }}>
            قصة البيانات
          </p>
          <h1 dir="auto" style={{ margin: 0, fontSize: 44, lineHeight: 1.35 }}>
            {data.fileName}
          </h1>
          <p dir="auto" style={{ margin: 0, fontSize: 17, lineHeight: 1.9, color: COVER_MUTED }}>
            {overview.snapshot}
          </p>
          <p style={{ margin: 0, fontSize: 13, color: COVER_MUTED }}>{arabicDate(data.date)}</p>
        </div>
      </Page>

      {insights.map((ins, i) => (
        <Page
          key={ins.evidence.id || i}
          index={++page}
          total={total}
          title={`الفصل ${i + 1}: ${ins.evidence.title}`}
          tocLabel={ins.evidence.title}
        >
          <p style={{ margin: 0, fontSize: 14, color: VIOLET, fontWeight: 700 }}>
            الفصل {i + 1} من {insights.length}
          </p>
          <h2 dir="auto" style={{ margin: "2px 0 14px", fontSize: 28, lineHeight: 1.5 }}>
            {ins.evidence.title}
          </h2>
          {headlines[i] && (
            <p
              dir="auto"
              style={{
                margin: "0 0 16px",
                padding: "4px 14px",
                borderInlineStart: `4px solid ${TEAL}`,
                fontSize: 18,
                lineHeight: 1.9,
              }}
            >
              {headlines[i]!.line}
            </p>
          )}
          <ReportChart plan={ins.plan} rows={ins.rows} height={290} />
          {ins.plan.analysis_ar?.trim() && (
            <p dir="auto" style={{ margin: "16px 0 0", fontSize: 14, lineHeight: 2, color: MUTED }}>
              {ins.plan.analysis_ar.trim()}
            </p>
          )}
          {actions[i] && (
            <Card style={{ marginTop: 16, padding: 14 }}>
              <p dir="auto" style={{ margin: 0, fontSize: 12.5, color: TEAL, fontWeight: 700 }}>
                ماذا يعني هذا؟ — {actions[i]!.title}
              </p>
              <p dir="auto" style={{ margin: "6px 0 0", fontSize: 13.5, lineHeight: 1.85 }}>
                {actions[i]!.text}
              </p>
            </Card>
          )}
          {data.aiNarratedIds?.includes(ins.evidence.id) && <AiNarrationBadge />}
        </Page>
      ))}

      <Page index={++page} total={total} title="الخلاصة">
        <SectionTitle>الخلاصة</SectionTitle>
        <p dir="auto" style={{ margin: "0 0 14px", fontSize: 14.5, lineHeight: 1.95 }}>
          {overview.snapshot}
        </p>
        {overview.findings.length > 0 && (
          <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
            {overview.findings.map((f, i) => (
              <Card key={i} style={{ padding: 12 }}>
                <p dir="auto" style={{ margin: 0, fontSize: 12.5, color: TEAL, fontWeight: 700 }}>
                  {f.title}
                </p>
                <p dir="auto" style={{ margin: "4px 0 0", fontSize: 13.5, lineHeight: 1.8 }}>
                  {f.line}
                </p>
              </Card>
            ))}
          </div>
        )}
        {actions.length > 0 && (
          <>
            <h3 style={{ margin: "0 0 8px", fontSize: 17, color: TEAL }}>الخطوات التالية</h3>
            <div style={{ display: "grid", gap: 6 }}>
              {actions.slice(0, 5).map((a, i) => (
                <p key={i} dir="auto" style={{ margin: 0, fontSize: 13, lineHeight: 1.75 }}>
                  <b>
                    {BUCKET_LABEL[a.bucket]} — {a.title}:{" "}
                  </b>
                  {a.text}
                </p>
              ))}
            </div>
          </>
        )}
        {overview.cautions.length > 0 && (
          <p dir="auto" style={{ margin: "16px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.8 }}>
            تحفّظات: {overview.cautions.join(" ")}
          </p>
        )}
        {data.seal && (
          <p
            dir="ltr"
            style={{
              margin: "12px 0 0",
              fontSize: 10.5,
              color: MUTED,
              fontFamily: '"IBM Plex Mono", monospace',
            }}
          >
            SHA-256: {data.seal.shortHash}…
          </p>
        )}
      </Page>
    </div>
  );
}
