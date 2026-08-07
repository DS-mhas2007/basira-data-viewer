/**
 * تصدير التقرير كعرض شرائح PowerPoint (.pptx) — يُبنى محلياً بالكامل في المتصفح.
 * الشرائح أصلية وقابلة للتعديل داخل PowerPoint (نصوص + مخططات حقيقية)، وليست صوراً.
 */
import type { ReportData } from "@/components/ReportDocument";
import { arabicDate, audienceMeta } from "@/lib/report";
import {
  anomalyAlerts,
  BUCKET_LABEL,
  executiveKpis,
  fmt,
  headlineInsights,
  insightStats,
  lineageLog,
  recommendationMatrix,
} from "@/lib/report-derive";
import { cleanCell } from "@/lib/report-format";

const NAVY = "010A19";
const CARD = "08172B";
const TEAL = "60F5D2";
const VIOLET = "D6B2FC";
const TEXT = "EEF2F7";
const MUTED = "93A3B8";
const LINE = "16304C";

const FONT = "Tajawal";
/** عرض/ارتفاع شريحة 16:9 بالبوصة. */
const W = 13.333;
const H = 7.5;

type Pptx = import("pptxgenjs").default;
type Slide = ReturnType<Pptx["addSlide"]>;

/** خلفية داكنة + شريط هوية علوي + ترويسة موحّدة. */
function baseSlide(pptx: Pptx, title: string, kicker?: string): Slide {
  const slide = pptx.addSlide();
  slide.background = { color: NAVY };
  slide.addShape("rect", { x: 0, y: 0, w: W, h: 0.09, fill: { color: TEAL } });
  if (kicker) {
    slide.addText(kicker, {
      x: 0.6, y: 0.42, w: W - 1.2, h: 0.3,
      fontFace: FONT, fontSize: 12, color: VIOLET, align: "right", rtlMode: true,
    });
  }
  slide.addText(title, {
    x: 0.6, y: kicker ? 0.72 : 0.5, w: W - 1.2, h: 0.7,
    fontFace: FONT, fontSize: 30, bold: true, color: TEXT, align: "right", rtlMode: true,
  });
  slide.addShape("rect", { x: 0.6, y: kicker ? 1.45 : 1.25, w: W - 1.2, h: 0.015, fill: { color: LINE } });
  return slide;
}

function footer(slide: Slide, text: string) {
  slide.addText(text, {
    x: 0.6, y: H - 0.62, w: W - 1.2, h: 0.3,
    fontFace: FONT, fontSize: 10, color: MUTED, align: "right", rtlMode: true,
  });
}

/** بطاقة داكنة بحواف ملوّنة تُستخدم للمؤشرات والتوصيات. */
function card(slide: Slide, x: number, y: number, w: number, h: number, accent = TEAL) {
  slide.addShape("roundRect", {
    x, y, w, h,
    rectRadius: 0.12,
    fill: { color: CARD },
    line: { color: accent, width: 0.75, transparency: 55 },
  });
}

function titleSlide(pptx: Pptx, data: ReportData) {
  const slide = pptx.addSlide();
  slide.background = { color: NAVY };
  slide.addShape("rect", { x: 0, y: 0, w: 0.14, h: H, fill: { color: TEAL } });
  slide.addText("بصيرة · تحليل بيانات محلي", {
    x: 0.9, y: 2.1, w: W - 1.8, h: 0.4,
    fontFace: FONT, fontSize: 15, color: VIOLET, align: "right", rtlMode: true,
  });
  slide.addText(audienceMeta(data.audience).label, {
    x: 0.9, y: 2.6, w: W - 1.8, h: 1.1,
    fontFace: FONT, fontSize: 46, bold: true, color: TEXT, align: "right", rtlMode: true,
  });
  slide.addText(data.fileName, {
    x: 0.9, y: 3.8, w: W - 1.8, h: 0.5,
    fontFace: FONT, fontSize: 20, color: TEAL, align: "right", rtlMode: true,
  });
  slide.addText(
    `${arabicDate(data.date)} · ${fmt(data.rowCount)} صف × ${data.columnCount} عمود`,
    {
      x: 0.9, y: 4.4, w: W - 1.8, h: 0.4,
      fontFace: FONT, fontSize: 14, color: MUTED, align: "right", rtlMode: true,
    },
  );
  slide.addText("جميع الحسابات نُفِّذت داخل المتصفح — لم تغادر البيانات جهاز المستخدم.", {
    x: 0.9, y: H - 1.1, w: W - 1.8, h: 0.4,
    fontFace: FONT, fontSize: 12, color: MUTED, align: "right", rtlMode: true,
  });
}

function kpiSlide(pptx: Pptx, data: ReportData) {
  const kpis = executiveKpis(data.insights, data.health, data.rowCount, data.columnCount);
  if (kpis.length === 0) return;
  const slide = baseSlide(pptx, "المؤشرات الرئيسية", "لمحة تنفيذية");
  const cols = Math.min(kpis.length, 3);
  const gap = 0.35;
  const cw = (W - 1.2 - gap * (cols - 1)) / cols;
  kpis.slice(0, 6).forEach((k, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const x = W - 0.6 - cw - col * (cw + gap);
    const y = 1.85 + row * 2.35;
    card(slide, x, y, cw, 2.05, i % 2 === 0 ? TEAL : VIOLET);
    slide.addText(k.label, {
      x: x + 0.22, y: y + 0.2, w: cw - 0.44, h: 0.4,
      fontFace: FONT, fontSize: 13, color: MUTED, align: "right", rtlMode: true,
    });
    slide.addText(k.value, {
      x: x + 0.22, y: y + 0.65, w: cw - 0.44, h: 0.8,
      fontFace: FONT, fontSize: 34, bold: true, color: i % 2 === 0 ? TEAL : VIOLET,
      align: "right", rtlMode: true,
    });
    slide.addText(k.hint, {
      x: x + 0.22, y: y + 1.45, w: cw - 0.44, h: 0.45,
      fontFace: FONT, fontSize: 11, color: MUTED, align: "right", rtlMode: true,
    });
  });
  footer(slide, "بصيرة · المؤشرات الرئيسية");
}

function bulletSlide(
  pptx: Pptx,
  title: string,
  kicker: string,
  items: { head: string; body: string; accent?: string }[],
) {
  if (items.length === 0) return;
  const slide = baseSlide(pptx, title, kicker);
  const shown = items.slice(0, 5);
  const h = Math.min(1.05, (H - 2.6) / shown.length);
  shown.forEach((it, i) => {
    const y = 1.75 + i * (h + 0.18);
    slide.addShape("roundRect", {
      x: W - 0.75, y: y + 0.12, w: 0.12, h: h - 0.2,
      rectRadius: 0.05, fill: { color: it.accent ?? TEAL },
    });
    slide.addText(it.head, {
      x: 0.6, y, w: W - 1.5, h: 0.36,
      fontFace: FONT, fontSize: 15, bold: true, color: TEXT, align: "right", rtlMode: true,
    });
    slide.addText(it.body, {
      x: 0.6, y: y + 0.34, w: W - 1.5, h: h - 0.34,
      fontFace: FONT, fontSize: 12.5, color: MUTED, align: "right", rtlMode: true,
      valign: "top",
    });
  });
  footer(slide, `بصيرة · ${title}`);
}

/** شريحة لكل استنتاج: مخطط أصلي قابل للتعديل + التحليل العربي. */
function insightSlides(pptx: Pptx, data: ReportData) {
  for (const ins of data.insights.slice(0, 10)) {
    const st = insightStats(ins);
    const slide = baseSlide(pptx, ins.evidence.title, "استنتاج");
    const chartW = 7.2;
    const chartX = W - 0.6 - chartW;

    if (st && st.points.length >= 2) {
      const points = st.points.slice(0, 12);
      const type = ins.plan.chart.type === "line" ? "line" : "bar";
      slide.addChart(
        type as "bar",
        [
          {
            name: st.metricCol,
            labels: points.map((p) => p.label),
            values: points.map((p) => p.value),
          },
        ],
        {
          x: chartX, y: 1.75, w: chartW, h: 4.6,
          chartColors: [TEAL, VIOLET],
          barDir: "col",
          catAxisLabelColor: MUTED,
          valAxisLabelColor: MUTED,
          catAxisLabelFontFace: FONT,
          valAxisLabelFontFace: FONT,
          catAxisLabelFontSize: 10,
          valAxisLabelFontSize: 10,
          catAxisLabelRotate: points.length > 6 ? 45 : 0,
          valGridLine: { color: LINE, style: "solid" },
          catGridLine: { style: "none" },
          showLegend: false,
          plotArea: { fill: { color: NAVY } },
          chartArea: { fill: { color: NAVY } },
        },
      );
    } else {
      card(slide, chartX, 1.75, chartW, 4.6);
      slide.addText("النتيجة ليست قابلة للرسم البياني — راجع الجدول في تقرير PDF.", {
        x: chartX + 0.3, y: 3.7, w: chartW - 0.6, h: 0.6,
        fontFace: FONT, fontSize: 13, color: MUTED, align: "center", rtlMode: true,
      });
    }

    const tx = 0.6;
    const tw = W - 1.2 - chartW - 0.4;
    const analysis = [ins.plan.intro_ar, ins.plan.analysis_ar].filter(Boolean).join("\n");
    slide.addText(analysis || "—", {
      x: tx, y: 1.85, w: tw, h: 3.2,
      fontFace: FONT, fontSize: 13, color: TEXT, align: "right", rtlMode: true, valign: "top",
      lineSpacingMultiple: 1.3,
    });
    if (st) {
      card(slide, tx, 5.15, tw, 1.2, VIOLET);
      slide.addText(
        `الأعلى: ${st.max.label} (${fmt(st.max.value)})\nالمتوسط: ${fmt(st.mean)} · النقاط: ${st.points.length}`,
        {
          x: tx + 0.2, y: 5.3, w: tw - 0.4, h: 0.9,
          fontFace: FONT, fontSize: 12, color: MUTED, align: "right", rtlMode: true,
        },
      );
    }
    footer(slide, `بصيرة · ${ins.evidence.resultRowCount} صف نتيجة`);
  }
}

function healthSlide(pptx: Pptx, data: ReportData) {
  const h = data.health;
  if (!h) return;
  const slide = baseSlide(pptx, "جودة البيانات", "ثقة الأرقام");
  const color = h.score >= 80 ? TEAL : h.score >= 50 ? "F5C978" : "FF7B7B";
  card(slide, W - 0.6 - 3.6, 1.85, 3.6, 3.2, color);
  slide.addText(`${h.score}`, {
    x: W - 0.6 - 3.6, y: 2.3, w: 3.6, h: 1.5,
    fontFace: FONT, fontSize: 76, bold: true, color, align: "center",
  });
  slide.addText("درجة الجودة من 100", {
    x: W - 0.6 - 3.6, y: 3.9, w: 3.6, h: 0.5,
    fontFace: FONT, fontSize: 13, color: MUTED, align: "center", rtlMode: true,
  });

  const stats = [
    ["خلايا مفقودة", fmt(h.missingCells)],
    ["صفوف مكرّرة", fmt(h.duplicateRows)],
    ["أعمدة بأنواع مختلطة", fmt(h.mismatchedColumns)],
    ["إجمالي الأعمدة", fmt(data.columnCount)],
  ];
  stats.forEach(([label, value], i) => {
    const y = 1.85 + i * 0.82;
    const w = W - 1.2 - 3.9;
    card(slide, 0.6, y, w, 0.68, i % 2 === 0 ? TEAL : VIOLET);
    slide.addText(String(label), {
      x: 0.8, y: y + 0.14, w: w - 0.4, h: 0.4,
      fontFace: FONT, fontSize: 13, color: MUTED, align: "right", rtlMode: true,
    });
    slide.addText(String(value), {
      x: 0.8, y: y + 0.14, w: w - 0.4, h: 0.4,
      fontFace: FONT, fontSize: 15, bold: true, color: TEXT, align: "left",
    });
  });
  footer(slide, "بصيرة · جودة البيانات");
}

function closingSlide(pptx: Pptx, data: ReportData) {
  const slide = pptx.addSlide();
  slide.background = { color: NAVY };
  slide.addText("شكراً", {
    x: 0.9, y: 2.9, w: W - 1.8, h: 1,
    fontFace: FONT, fontSize: 44, bold: true, color: TEAL, align: "center", rtlMode: true,
  });
  slide.addText(
    `أُنشئ هذا العرض محلياً بواسطة «بصيرة» من ملف ${data.fileName} بتاريخ ${arabicDate(data.date)}.`,
    {
      x: 0.9, y: 3.9, w: W - 1.8, h: 0.6,
      fontFace: FONT, fontSize: 14, color: MUTED, align: "center", rtlMode: true,
    },
  );
}

function pptxFileName(sourceName: string, d: Date): string {
  const base = sourceName.replace(/\.[^.]+$/, "").replace(/[\\/:*?"<>|]+/g, "_").trim() || "بيانات";
  const p = (n: number) => String(n).padStart(2, "0");
  return `عرض-بصيرة-${base}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.pptx`;
}

/** يبني ملف .pptx وينزّله. */
export async function downloadPptx(data: ReportData): Promise<void> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS() as Pptx;
  pptx.layout = "LAYOUT_16x9";
  pptx.rtlMode = true;
  pptx.author = "بصيرة";
  pptx.title = `تقرير بصيرة — ${data.fileName}`;

  titleSlide(pptx, data);
  if (data.sections.kpi) kpiSlide(pptx, data);
  if (data.sections.headline) {
    bulletSlide(
      pptx,
      "الاستنتاجات الذهبية",
      "الخلاصة بالأرقام",
      headlineInsights(data.insights).map((h) => ({ head: h.title, body: h.line })),
    );
  }
  if (data.sections.health) healthSlide(pptx, data);
  if (data.sections.insights) insightSlides(pptx, data);
  if (data.sections.anomalies) {
    bulletSlide(
      pptx,
      "تنبيهات الانحراف",
      "أرقام تستدعي المراجعة",
      anomalyAlerts(data.insights, data.health).map((a) => ({
        head: a.title,
        body: a.detail,
        accent: "FF7B7B",
      })),
    );
  }
  if (data.sections.actions) {
    bulletSlide(
      pptx,
      "مصفوفة التوصيات",
      "الخطوة التالية",
      recommendationMatrix(data.insights, data.health).map((a) => ({
        head: `${BUCKET_LABEL[a.bucket]} — ${a.title}`,
        body: a.text,
        accent: a.bucket === "risk" ? "FF7B7B" : a.bucket === "growth" ? VIOLET : TEAL,
      })),
    );
  }
  if (data.sections.topBottom) {
    for (const list of topBottomForSlides(data)) bulletSlideRaw(pptx, list);
  }
  if (data.sections.lineage) {
    bulletSlide(
      pptx,
      "سجل التنظيف والتحويلات",
      "شفافية المعالجة",
      lineageLog(data.cleanSteps).map((l) => ({ head: `${l.order}. ${l.label}`, body: l.detail })),
    );
  }
  closingSlide(pptx, data);

  await pptx.writeFile({ fileName: pptxFileName(data.fileName, data.date) });
}

/* ============ قوائم التوب/الفلوب كشرائح ============ */

interface RawSlide {
  title: string;
  kicker: string;
  rows: { label: string; value: string }[];
}

function topBottomForSlides(data: ReportData): RawSlide[] {
  // استيراد كسول لتفادي دورة الاستيراد مع report-derive
  const lists = (data.insights.length > 0 ? topBottomListsSafe(data) : []) as RawSlide[];
  return lists;
}

function topBottomListsSafe(data: ReportData): RawSlide[] {
  const out: RawSlide[] = [];
  for (const ins of data.insights.slice(0, 3)) {
    const st = insightStats(ins);
    if (!st || st.points.length < 3) continue;
    const sorted = [...st.points].sort((a, b) => b.value - a.value);
    out.push({
      title: `الأعلى والأدنى — ${cleanCell(st.metricCol)}`,
      kicker: ins.evidence.title,
      rows: [
        ...sorted.slice(0, 5).map((p) => ({ label: `▲ ${p.label}`, value: fmt(p.value) })),
        ...sorted.slice(-3).reverse().map((p) => ({ label: `▼ ${p.label}`, value: fmt(p.value) })),
      ],
    });
  }
  return out;
}

function bulletSlideRaw(pptx: Pptx, list: RawSlide) {
  const slide = baseSlide(pptx, list.title, list.kicker);
  list.rows.slice(0, 8).forEach((r, i) => {
    const y = 1.8 + i * 0.62;
    const w = W - 1.2;
    card(slide, 0.6, y, w, 0.52, r.label.startsWith("▲") ? TEAL : VIOLET);
    slide.addText(r.label, {
      x: 0.8, y: y + 0.08, w: w - 0.4, h: 0.36,
      fontFace: FONT, fontSize: 13, color: TEXT, align: "right", rtlMode: true,
    });
    slide.addText(r.value, {
      x: 0.8, y: y + 0.08, w: w - 0.4, h: 0.36,
      fontFace: FONT, fontSize: 13, bold: true, color: TEAL, align: "left",
    });
  });
  footer(slide, "بصيرة · قوائم الأداء");
}