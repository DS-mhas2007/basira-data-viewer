/**
 * الوحدة 8: مستند التقرير التنفيذي (يُرسم خارج الشاشة ثم يُحوَّل إلى PDF).
 * ألوان الهوية ثابتة هنا عمداً لأن مخرج PDF لا يرث متغيّرات الثيم.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Scatter,
  ScatterChart,
  XAxis,
  YAxis,
} from "recharts";
import { BasiraLogo } from "@/components/BasiraLogo";
import { severityOfScore, type HealthReport } from "@/lib/data-health";
import type { CleanStep } from "@/lib/cleaning";
import type { AiPlan } from "@/lib/ai-query.functions";
import type { Row } from "@/lib/parse-file";
import {
  arabicDate,
  RECOMMENDATION_BY_INTENT,
  type PinnedInsight,
  type ReportVariant,
} from "@/lib/report";

const NAVY = "#010A19";
const TEAL = "#60F5D2";
const VIOLET = "#D6B2FC";
const TEXT = "#EEF2F7";
const MUTED = "#93A3B8";
const LINE = "rgba(238,242,247,0.14)";
const CARD = "#08172B";

export const PAGE_W = 794;
export const PAGE_H = 1123;
const PAD = 52;

const SCORE_COLOR = { good: TEAL, warn: "#F5C978", bad: "#FF7B7B" } as const;
const CHART_COLORS = [TEAL, VIOLET, "#7FB2FF", "#F5C978"];

function Page({
  children,
  index,
  total,
  footer = true,
  title,
}: {
  children: React.ReactNode;
  index: number;
  total: number;
  footer?: boolean;
  /** اسم القسم — يُستخدم عند تصدير الصفحة كصورة PNG مستقلة. */
  title?: string;
}) {
  return (
    <div
      data-pdf-page=""
      data-section-title={title ?? `صفحة ${index}`}
      dir="rtl"
      style={{
        position: "relative",
        width: PAGE_W,
        height: PAGE_H,
        background: NAVY,
        color: TEXT,
        fontFamily: '"IBM Plex Sans Arabic", sans-serif',
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div style={{ padding: PAD, height: PAGE_H - (footer ? 64 : 0), boxSizing: "border-box", overflow: "hidden" }}>
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
            <BasiraLogo micro style={{ width: 26, height: 26, flexShrink: 0, marginInlineEnd: 6 }} />
            تم إنشاؤه بواسطة بصيرة
          </span>
          <span dir="ltr" style={{ fontFamily: '"Fira Code", monospace', whiteSpace: "nowrap" }}>
            {index} / {total}
          </span>
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontSize: 24,
        fontWeight: 700,
        margin: "0 0 6px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <span style={{ width: 6, height: 26, borderRadius: 3, background: TEAL, display: "inline-block" }} />
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
        borderRadius: 16,
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
    const o: Record<string, unknown> = { [x]: String(r[x] ?? "") };
    for (const m of metrics) o[m] = Number(r[m] ?? 0);
    return o;
  });

  const w = PAGE_W - PAD * 2 - 36;
  const h = height;
  const axis = { fill: MUTED, fontSize: 10, fontFamily: '"Fira Code", monospace' } as const;
  const common = { width: w, height: h, data } as const;

  return (
    <Card style={{ padding: 18 }}>
      <div dir="ltr" style={{ direction: "ltr" }}>
        {plan.chart.type === "line" ? (
          <LineChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={LINE} />
            <XAxis dataKey={x} tick={axis} stroke={MUTED} />
            <YAxis tick={axis} stroke={MUTED} />
            {metrics.map((m, i) => (
              <Line
                key={m}
                type="monotone"
                dataKey={m}
                stroke={CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        ) : plan.chart.type === "scatter" ? (
          <ScatterChart width={w} height={h}>
            <CartesianGrid strokeDasharray="3 3" stroke={LINE} />
            <XAxis dataKey={x} tick={axis} stroke={MUTED} />
            <YAxis dataKey={metrics[0] ?? x} tick={axis} stroke={MUTED} />
            <Scatter data={data} fill={TEAL} isAnimationActive={false} />
          </ScatterChart>
        ) : (
          <BarChart {...common}>
            <CartesianGrid strokeDasharray="3 3" stroke={LINE} />
            <XAxis dataKey={x} tick={axis} stroke={MUTED} />
            <YAxis tick={axis} stroke={MUTED} />
            {metrics.map((m, i) => (
              <Bar
                key={m}
                dataKey={m}
                fill={CHART_COLORS[i % CHART_COLORS.length]}
                radius={[5, 5, 0, 0]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        )}
      </div>
    </Card>
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
}

function Kpis({ items }: { items: ReturnType<typeof executiveKpis> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: items.length > 3 ? "1fr 1fr" : "1fr", gap: 12 }}>
      {items.map((k, i) => (
        <Card key={i} style={{ padding: 18 }}>
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{k.label}</p>
          <p
            dir="auto"
            style={{
              margin: "8px 0 0",
              fontSize: 42,
              fontWeight: 700,
              lineHeight: 1.1,
              color: i % 2 === 0 ? TEAL : VIOLET,
              fontFamily: '"Fira Code", monospace',
              wordBreak: "break-word",
            }}
          >
            {k.value}
          </p>
          <p dir="auto" style={{ margin: "8px 0 0", fontSize: 11.5, color: MUTED }}>
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
  immediate: TEAL,
  growth: VIOLET,
  risk: "#F5C978",
};

/** يبني صفحات التقرير حسب الجمهور والأقسام المختارة. */
export function ReportDocument({ data }: { data: ReportData }) {
  const s = data.sections;
  const h = data.health;
  const severity = h ? severityOfScore(h.score) : "good";
  const insights = s.insights || s.headline || s.actions || s.sql || s.topBottom || s.anomalies
    ? data.insights.slice(0, 5)
    : [];
  const meta = audienceMeta(data.audience);

  const kpis = s.kpi ? executiveKpis(insights, h, data.rowCount, data.columnCount) : [];
  const headlines = s.headline ? headlineInsights(insights) : [];
  const actions = s.actions ? recommendationMatrix(insights, h) : [];
  const lists = s.topBottom ? topBottomLists(insights) : [];
  const alerts = s.anomalies ? anomalyAlerts(insights, h) : [];
  const lineage = s.lineage ? lineageLog(data.cleanSteps) : [];
  const healthLogPages = s.healthLog && h ? chunk(h.columns, 14) : [];
  const sqlPages = s.sql ? chunk(insights, 2) : [];

  // حساب عدد الصفحات مسبقاً حتى يظهر ترقيم صحيح "x / y".
  const total =
    1 +
    (s.kpi ? 1 : 0) +
    (headlines.length > 0 ? 1 : 0) +
    (actions.length > 0 ? 1 : 0) +
    (s.health ? 1 : 0) +
    healthLogPages.length +
    (s.stats && h ? 1 : 0) +
    (lineage.length > 0 || (s.lineage && data.cleanSteps.length === 0) ? 1 : 0) +
    lists.length +
    (alerts.length > 0 ? 1 : 0) +
    (s.insights ? insights.length : 0) +
    sqlPages.length +
    (s.methodology ? 1 : 0);
  let page = 0;

  return (
    <div>
      {/* 1) الغلاف */}
      <Page index={++page} total={total} footer={false} title="الغلاف">
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(680px 420px at 80% 8%, rgba(96,245,210,0.16), transparent 70%), radial-gradient(520px 380px at 12% 92%, rgba(214,178,252,0.16), transparent 70%)",
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
          <BasiraLogo style={{ width: 150, height: 150, marginInline: "auto" }} />
          <div>
            <p style={{ margin: 0, fontSize: 20, color: TEAL, fontWeight: 600 }}>بصيرة</p>
            <h1 style={{ margin: "10px 0 0", fontSize: 48, fontWeight: 700, lineHeight: 1.25 }}>
              {meta.label}
            </h1>
            <p style={{ margin: "10px 0 0", fontSize: 15, color: VIOLET }}>موجَّه إلى: {meta.audience}</p>
          </div>
          <div style={{ height: 4, width: 180, borderRadius: 2, background: `linear-gradient(90deg, ${TEAL}, ${VIOLET})` }} />
          <div style={{ fontSize: 16, lineHeight: 2.1, color: MUTED }}>
            <p style={{ margin: 0 }}>
              الملف المُحلَّل:{" "}
              <span dir="auto" style={{ color: TEXT, fontWeight: 600 }}>
                {data.fileName}
              </span>
            </p>
            <p style={{ margin: 0 }}>
              تاريخ إنشاء التقرير: <span style={{ color: TEXT }}>{arabicDate(data.date)}</span>
            </p>
            {h && (
              <p style={{ margin: 0 }}>
                جودة البيانات:{" "}
                <span style={{ color: SCORE_COLOR[severity] }}>
                  {severity === "good" ? "🟢" : severity === "warn" ? "🟡" : "🔴"} موثوقة بنسبة {h.score}%
                </span>
              </p>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
            جميع عمليات التحليل تمت محلياً داخل متصفحك دون رفع أي بيانات.
          </p>
        </div>
      </Page>

      {/* كروت المؤشرات الرئيسية */}
      {s.kpi && (
        <Page index={++page} total={total} title="المؤشرات الرئيسية">
          <SectionTitle>المؤشرات الرئيسية</SectionTitle>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 18px" }}>
            أهم الأرقام المستخلصة من الملف — للاطّلاع السريع قبل التفاصيل.
          </p>
          <Kpis items={kpis} />
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
                  <span style={{ color: SCORE_COLOR[severity], fontFamily: '"Fira Code", monospace' }}>
                    {h.score}%
                  </span>
                </span>
              </Card>
            </div>
          )}
        </Page>
      )}

      {/* الاستنتاج الذهبي */}
      {headlines.length > 0 && (
        <Page index={++page} total={total} title="الاستنتاج الذهبي">
          <SectionTitle>الاستنتاج الذهبي</SectionTitle>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 18px" }}>جملة واحدة تختصر كل محور تحليلي.</p>
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

      {/* مصفوفة التوصيات */}
      {actions.length > 0 && (
        <Page index={++page} total={total} title="مصفوفة التوصيات">
          <SectionTitle>مصفوفة التوصيات السريعة</SectionTitle>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 18px" }}>
            توصيات مصنّفة حسب نوع الإجراء المطلوب.
          </p>
          <div style={{ display: "grid", gap: 14 }}>
            {(["immediate", "growth", "risk"] as ActionBucket[]).map((b) => {
              const items = actions.filter((a) => a.bucket === b);
              if (items.length === 0) return null;
              return (
                <Card key={b} style={{ padding: 16, borderInlineStart: `4px solid ${BUCKET_COLOR[b]}` }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: BUCKET_COLOR[b] }}>
                    {BUCKET_LABEL[b]}
                  </p>
                  <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
                    {items.map((a, i) => (
                      <div key={i}>
                        <p dir="auto" style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>
                          {a.title}
                        </p>
                        <p dir="auto" style={{ margin: "4px 0 0", fontSize: 12.5, lineHeight: 1.9, color: MUTED }}>
                          {a.text}
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

      {/* ملخص جودة البيانات */}
      {s.health && (
        <Page index={++page} total={total} title="ملخص جودة البيانات">
          <SectionTitle>ملخص جودة البيانات</SectionTitle>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 20px" }}>
            محسوبة بأوزان ثابتة عبر استعلامات SQL على محرك DuckDB — بدون ذكاء اصطناعي.
          </p>
          <div style={{ display: "flex", gap: 16, alignItems: "stretch" }}>
            <Card style={{ width: 230, textAlign: "center", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <p style={{ margin: 0, fontSize: 13, color: MUTED }}>درجة جودة البيانات</p>
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: 76,
                  fontWeight: 700,
                  lineHeight: 1,
                  color: h ? SCORE_COLOR[severity] : MUTED,
                  fontFamily: '"Fira Code", monospace',
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
                  <p style={{ margin: "6px 0 0", fontSize: 24, fontWeight: 700, fontFamily: '"Fira Code", monospace' }}>
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
                    <span style={{ color: SCORE_COLOR[i.severity], fontFamily: '"Fira Code", monospace', whiteSpace: "nowrap" }}>
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
      {healthLogPages.map((cols, pi) => (
        <Page key={`log-${pi}`} index={++page} total={total} title={`سجل الجودة ${pi + 1}`}>
          <SectionTitle>سجل جودة البيانات التفصيلي</SectionTitle>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 16px" }}>
            كل عمود بالعدد والنسبة المئوية — للتدقيق والتحقق ({pi + 1} من {healthLogPages.length}).
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
                  background: i % 2 ? "rgba(255,255,255,0.02)" : "transparent",
                }}
              >
                <span dir="auto" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.name}
                </span>
                <span dir="ltr" style={{ fontFamily: '"Fira Code", monospace', color: MUTED }}>
                  {c.type}
                </span>
                <span style={{ fontFamily: '"Fira Code", monospace' }}>{num(c.nullCount)}</span>
                <span
                  style={{
                    fontFamily: '"Fira Code", monospace',
                    color: c.nullRatio > 0.1 ? "#FF7B7B" : c.nullRatio > 0.02 ? "#F5C978" : MUTED,
                  }}
                >
                  {(c.nullRatio * 100).toFixed(1)}%
                </span>
                <span style={{ fontFamily: '"Fira Code", monospace', color: MUTED }}>{num(c.distinctCount)}</span>
                <span
                  style={{
                    fontFamily: '"Fira Code", monospace',
                    color: c.typeMismatchCount > 0 ? "#F5C978" : MUTED,
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
      {s.stats && h && (
        <Page index={++page} total={total} title="الحدود الإحصائية">
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
            {h.columns
              .filter((c) => c.isNumeric)
              .slice(0, 16)
              .map((c, i) => (
                <div
                  key={c.name}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr",
                    fontSize: 11.5,
                    padding: "9px 12px",
                    gap: 8,
                    borderTop: `1px solid ${LINE}`,
                    background: i % 2 ? "rgba(255,255,255,0.02)" : "transparent",
                  }}
                >
                  <span dir="auto" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name}
                  </span>
                  <span style={{ fontFamily: '"Fira Code", monospace' }}>{c.min === null ? "—" : fmt(c.min)}</span>
                  <span style={{ fontFamily: '"Fira Code", monospace' }}>{c.median === null ? "—" : fmt(c.median)}</span>
                  <span style={{ fontFamily: '"Fira Code", monospace' }}>{c.max === null ? "—" : fmt(c.max)}</span>
                  <span style={{ fontFamily: '"Fira Code", monospace', color: c.nullRatio > 0.1 ? "#F5C978" : MUTED }}>
                    {(c.nullRatio * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
          </div>
          <div style={{ marginTop: 16 }}>
            <Card>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 2, color: MUTED }}>
                نسبة القيم المفقودة الإجمالية {(h.missingRatio * 100).toFixed(1)}% — كل عمود تتجاوز فيه النسبة 10%
                يقلّل موثوقية المتوسطات والمجاميع المحسوبة عليه، ويُنصح بتقييد التفسير أو معالجة النقص أولاً.
                الصفوف المكررة ({num(h.duplicateRows)}) قد تضخّم المجاميع إن لم تُزل.
              </p>
            </Card>
          </div>
        </Page>
      )}

      {/* سجل التحويلات والتنظيف */}
      {s.lineage && (
        <Page index={++page} total={total} title="سجل التحويلات">
          <SectionTitle>سجل التحويلات والتنظيف (Audit Trail)</SectionTitle>
          <p style={{ color: MUTED, fontSize: 13, margin: "0 0 16px" }}>
            توثيق كل خطوة طُبِّقت على الملف الخام — التنظيف غير تدميري ويُنفَّذ عبر VIEW في DuckDB.
          </p>
          {lineage.length === 0 ? (
            <Card>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 2, color: MUTED }}>
                لم تُطبَّق أي عملية تنظيف — جميع الأرقام في هذا التقرير محسوبة على الملف الخام كما رُفع.
              </p>
            </Card>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {lineage.map((l) => (
                <Card key={l.order} style={{ padding: 14, display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span
                    style={{
                      fontFamily: '"Fira Code", monospace',
                      color: TEAL,
                      fontSize: 13,
                      flexShrink: 0,
                    }}
                  >
                    {String(l.order).padStart(2, "0")}
                  </span>
                  <span style={{ flex: 1 }}>
                    <p dir="auto" style={{ margin: 0, fontSize: 13.5 }}>
                      {l.label}
                    </p>
                    <p dir="auto" style={{ margin: "4px 0 0", fontSize: 11.5, color: MUTED }}>
                      {l.detail}
                    </p>
                  </span>
                </Card>
              ))}
            </div>
          )}
        </Page>
      )}

      {/* قوائم التوب والفلوب */}
      {lists.map((list, li) => (
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
              { head: "أسوأ 10", rows: list.bottom, color: "#FF7B7B" },
            ].map((side) => (
              <Card key={side.head} style={{ padding: 14 }}>
                <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: side.color }}>{side.head}</p>
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
                      <span dir="auto" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {i + 1}. {r.label}
                      </span>
                      <span style={{ fontFamily: '"Fira Code", monospace', color: side.color, whiteSpace: "nowrap" }}>
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
      {alerts.length > 0 && (
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
                  borderInlineStart: `4px solid ${a.level === "bad" ? "#FF7B7B" : "#F5C978"}`,
                }}
              >
                <p dir="auto" style={{ margin: 0, fontSize: 13.5, fontWeight: 600 }}>
                  {a.title}
                </p>
                <p dir="auto" style={{ margin: "5px 0 0", fontSize: 12.5, lineHeight: 1.9, color: MUTED }}>
                  {a.detail}
                </p>
              </Card>
            ))}
          </div>
        </Page>
      )}

      {/* صفحات الاستنتاجات */}
      {s.insights &&
        insights.map((ins, idx) => (
          <Page key={ins.evidence.id} index={++page} total={total} title={`الاستنتاج ${idx + 1}`}>
            <SectionTitle>{`الاستنتاج ${idx + 1} من ${insights.length}`}</SectionTitle>
            <h3 dir="auto" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.8, margin: "14px 0 16px" }}>
              {ins.evidence.title}
            </h3>

            {ins.plan.intro_ar?.trim() && (
              <p dir="auto" style={{ margin: "0 0 16px", fontSize: 14.5, lineHeight: 2, color: TEXT }}>
                {ins.plan.intro_ar.trim()}
              </p>
            )}

            {ins.evidence.highlights.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {ins.evidence.highlights.map((m, i) => (
                  <Card key={i} style={{ padding: 14 }}>
                    <p style={{ margin: 0, fontSize: 30, fontWeight: 700, color: TEAL, fontFamily: '"Fira Code", monospace' }}>
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
              <p dir="auto" style={{ margin: "16px 0 0", fontSize: 13.5, lineHeight: 2, color: MUTED }}>
                {ins.plan.analysis_ar.trim()}
              </p>
            )}
          </Page>
        ))}

      {/* شجرة استعلامات SQL والمنهجية */}
      {sqlPages.map((group, gi) => (
        <Page key={`sql-${gi}`} index={++page} total={total} title={`استعلامات SQL ${gi + 1}`}>
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
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "10px 0", fontSize: 11, color: MUTED }}>
                  <span style={{ border: `1px solid ${LINE}`, borderRadius: 9, padding: "4px 9px" }}>
                    الصفوف الداخلة:{" "}
                    <span style={{ color: TEXT, fontFamily: '"Fira Code", monospace' }}>
                      {ins.evidence.baseRowCount === null ? "—" : num(ins.evidence.baseRowCount)}
                    </span>
                  </span>
                  <span style={{ border: `1px solid ${LINE}`, borderRadius: 9, padding: "4px 9px" }}>
                    صفوف النتيجة:{" "}
                    <span style={{ color: TEXT, fontFamily: '"Fira Code", monospace' }}>
                      {num(ins.evidence.resultRowCount)}
                    </span>
                  </span>
                  <span style={{ border: `1px solid ${LINE}`, borderRadius: 9, padding: "4px 9px" }}>
                    نوع التحليل: <span style={{ color: TEXT }}>{ins.plan.intent}</span>
                  </span>
                </div>
                <pre
                  dir="ltr"
                  style={{
                    margin: 0,
                    background: "rgba(0,0,0,0.35)",
                    border: `1px solid ${LINE}`,
                    borderRadius: 10,
                    padding: 12,
                    fontFamily: '"Fira Code", monospace',
                    fontSize: 10.5,
                    lineHeight: 1.7,
                    color: TEXT,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    maxHeight: 260,
                    overflow: "hidden",
                    textAlign: "left",
                  }}
                >
                  {ins.evidence.sql}
                </pre>
                {ins.evidence.filters.length > 0 && (
                  <p dir="auto" style={{ margin: "10px 0 0", fontSize: 11, color: MUTED }}>
                    الفلاتر: {ins.evidence.filters.slice(0, 4).join(" — ")}
                  </p>
                )}
                {ins.evidence.warnings.length > 0 && (
                  <p dir="auto" style={{ margin: "6px 0 0", fontSize: 11, color: "#F5C978" }}>
                    حدود النتيجة: {ins.evidence.warnings.slice(0, 2).join(" — ")}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </Page>
      ))}

      {/* المنهجية والقيود */}
      {s.methodology && (
        <Page index={++page} total={total} title="المنهجية والقيود">
          <SectionTitle>المنهجية والقيود</SectionTitle>
          <ul style={{ margin: "16px 0 0", paddingInlineStart: 22, fontSize: 13.5, lineHeight: 2.2, color: MUTED, listStyleType: "disc" }}>
            <li>جميع البيانات عولجت محلياً داخل متصفح المستخدم عبر محرك DuckDB، ولم تُرفع إلى أي خادم خارجي.</li>
            <li>
              كل استنتاج مبني على استعلام SQL قابل للتدقيق، ويمكن عرضه ونسخه من بطاقة الدليل داخل واجهة بصيرة عبر قسم
              «عرض الاستعلام SQL».
            </li>
            <li>درجة جودة البيانات محسوبة بأوزان ثابتة: القيم المفقودة 40، التكرار 30، تعارض الأنواع 30.</li>
            <li>اكتشاف القيم الشاذة إحصائي بطبيعته (انحراف معياري)، وليس إثباتاً قاطعاً على وجود خطأ.</li>
            <li>عمليات التنظيف غير تدميرية: الملف الأصلي لم يُعدَّل، وكل تحويل يمكن التراجع عنه داخل الواجهة.</li>
            <li>هذا التقرير لا يغني عن مراجعة محلل بيانات خبير في القرارات عالية المخاطر.</li>
          </ul>
        </Page>
      )}
    </div>
  );
}
