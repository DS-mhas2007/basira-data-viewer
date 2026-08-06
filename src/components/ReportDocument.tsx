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
import { arabicDate, RECOMMENDATION_BY_INTENT, type PinnedInsight } from "@/lib/report";

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
}: {
  children: React.ReactNode;
  index: number;
  total: number;
  footer?: boolean;
}) {
  return (
    <div
      data-pdf-page=""
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
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BasiraLogo micro style={{ width: 16, height: 16 }} />
            تم إنشاؤه بواسطة بصيرة
          </span>
          <span style={{ fontFamily: '"Fira Code", monospace' }}>
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

function ReportChart({ plan, rows }: { plan: AiPlan; rows: Row[] }) {
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
  const h = 250;
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
}

/** يبني صفحات التقرير بالترتيب: غلاف، ملخص الجودة، الاستنتاجات، التوصيات، المنهجية. */
export function ReportDocument({ data }: { data: ReportData }) {
  const insights = data.insights.slice(0, 5);
  const total = 3 + insights.length + 1;
  const h = data.health;
  const severity = h ? severityOfScore(h.score) : "good";
  let page = 0;

  return (
    <div>
      {/* 1) الغلاف */}
      <Page index={++page} total={total} footer={false}>
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
            gap: 22,
          }}
        >
          <BasiraLogo style={{ width: 120, height: 120 }} />
          <div>
            <p style={{ margin: 0, fontSize: 20, color: TEAL, fontWeight: 600 }}>بصيرة</p>
            <h1 style={{ margin: "10px 0 0", fontSize: 52, fontWeight: 700, lineHeight: 1.25 }}>
              تقرير تحليل البيانات
            </h1>
          </div>
          <div style={{ height: 4, width: 180, borderRadius: 2, background: `linear-gradient(90deg, ${TEAL}, ${VIOLET})` }} />
          <div style={{ fontSize: 17, lineHeight: 2.1, color: MUTED }}>
            <p style={{ margin: 0 }}>
              الملف المُحلَّل:{" "}
              <span dir="auto" style={{ color: TEXT, fontWeight: 600 }}>
                {data.fileName}
              </span>
            </p>
            <p style={{ margin: 0 }}>
              تاريخ إنشاء التقرير: <span style={{ color: TEXT }}>{arabicDate(data.date)}</span>
            </p>
            <p style={{ margin: 0 }}>
              عدد الاستنتاجات المثبتة: <span style={{ color: TEXT }}>{num(insights.length)}</span>
            </p>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: MUTED }}>
            جميع عمليات التحليل تمت محلياً داخل متصفحك دون رفع أي بيانات.
          </p>
        </div>
      </Page>

      {/* 2) ملخص جودة البيانات */}
      <Page index={++page} total={total}>
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

        {data.cleanSteps.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>عمليات التنظيف المطبّقة</h3>
            <ol style={{ margin: 0, paddingInlineStart: 22, fontSize: 13, lineHeight: 2.1, color: MUTED }}>
              {data.cleanSteps.slice(0, 8).map((s) => (
                <li key={s.id}>
                  <span style={{ color: TEXT }}>{s.label}</span>
                  {s.affectedRows > 0 && ` — الصفوف المتأثرة: ${num(s.affectedRows)}`}
                </li>
              ))}
            </ol>
          </div>
        )}

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
                  <span>{i.title}</span>
                  <span style={{ color: SCORE_COLOR[i.severity], fontFamily: '"Fira Code", monospace' }}>
                    {num(i.affectedRows)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Page>

      {/* 3) الاستنتاجات المثبتة */}
      {insights.map((ins, idx) => (
        <Page key={ins.evidence.id} index={++page} total={total}>
          <SectionTitle>{`الاستنتاج ${idx + 1} من ${insights.length}`}</SectionTitle>
          <h3 style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.8, margin: "14px 0 16px" }}>
            {ins.evidence.title}
          </h3>

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

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, fontSize: 12, color: MUTED }}>
            <span style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: "6px 12px" }}>
              الصفوف الداخلة في الحساب:{" "}
              <span style={{ color: TEXT, fontFamily: '"Fira Code", monospace' }}>
                {ins.evidence.baseRowCount === null ? "—" : num(ins.evidence.baseRowCount)}
              </span>
            </span>
            <span style={{ border: `1px solid ${LINE}`, borderRadius: 10, padding: "6px 12px" }}>
              صفوف النتيجة:{" "}
              <span style={{ color: TEXT, fontFamily: '"Fira Code", monospace' }}>
                {num(ins.evidence.resultRowCount)}
              </span>
            </span>
          </div>

          {ins.evidence.filters.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: MUTED }}>الفلاتر المطبقة:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {ins.evidence.filters.slice(0, 5).map((f, i) => (
                  <span
                    key={i}
                    dir="ltr"
                    style={{
                      border: `1px solid rgba(214,178,252,0.4)`,
                      background: "rgba(214,178,252,0.1)",
                      color: VIOLET,
                      borderRadius: 10,
                      padding: "5px 10px",
                      fontSize: 11,
                      fontFamily: '"Fira Code", monospace',
                      maxWidth: 320,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          <ReportChart plan={ins.plan} rows={ins.rows} />

          {ins.evidence.warnings.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <p style={{ margin: "0 0 6px", fontSize: 13, color: "#F5C978" }}>ملاحظات وحدود النتيجة:</p>
              <ul style={{ margin: 0, paddingInlineStart: 20, fontSize: 12, lineHeight: 1.9, color: MUTED }}>
                {ins.evidence.warnings.slice(0, 3).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </Page>
      ))}

      {/* 4) التوصيات + المنهجية */}
      <Page index={++page} total={total}>
        <SectionTitle>توصيات قابلة للتنفيذ</SectionTitle>
        <div style={{ display: "grid", gap: 10, margin: "16px 0 26px" }}>
          {insights.map((ins, i) => (
            <Card key={ins.evidence.id} style={{ padding: 14 }}>
              <p style={{ margin: 0, fontSize: 13, color: TEAL, fontWeight: 600 }}>
                {i + 1}. {ins.evidence.title}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 13, lineHeight: 1.9, color: MUTED }}>
                {RECOMMENDATION_BY_INTENT[ins.plan.intent]}
              </p>
            </Card>
          ))}
        </div>

        <SectionTitle>المنهجية والقيود</SectionTitle>
        <ul style={{ margin: "16px 0 0", paddingInlineStart: 22, fontSize: 13.5, lineHeight: 2.2, color: MUTED }}>
          <li>
            جميع البيانات عولجت محلياً داخل متصفح المستخدم عبر محرك DuckDB، ولم تُرفع إلى أي خادم خارجي.
          </li>
          <li>
            كل استنتاج مبني على استعلام SQL قابل للتدقيق، ويمكن عرضه ونسخه من بطاقة الدليل الخاصة به داخل واجهة
            بصيرة عبر قسم «عرض الاستعلام SQL».
          </li>
          <li>
            اكتشاف القيم الشاذة وتقييم جودة البيانات إحصائي بطبيعته، وليس إثباتاً قاطعاً على وجود خطأ في البيانات.
          </li>
          <li>
            عمليات التنظيف غير تدميرية: الملف الأصلي لم يُعدَّل، وكل تحويل يمكن التراجع عنه داخل الواجهة.
          </li>
          <li>
            هذا التقرير لا يغني عن مراجعة محلل بيانات خبير في القرارات عالية المخاطر.
          </li>
        </ul>
      </Page>
    </div>
  );
}
