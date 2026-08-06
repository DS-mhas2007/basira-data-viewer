/**
 * التقرير التفاعلي المستقل (Interactive HTML Dashboard Export).
 * يولّد ملف HTML واحد يعمل بلا إنترنت وبلا اعتماد على منصة بصيرة:
 * الرسوم مرسومة بـ SVG inline، والفلترة والبحث بجافاسكربت مضمّنة.
 */
import type { HealthReport } from "@/lib/data-health";
import type { CleanStep } from "@/lib/cleaning";
import type { PinnedInsight } from "@/lib/report";
import type { AnomalySignal } from "@/lib/anomaly-radar";
import type { AuditSeal } from "@/lib/audit-seal";
import type { PlaybookResult } from "@/lib/playbooks";
import type { Row } from "@/lib/parse-file";
import { pickLabelMetric } from "@/lib/report-derive";

export interface HtmlReportInput {
  fileName: string;
  health: HealthReport | null;
  rowCount: number;
  columnCount: number;
  cleanSteps: CleanStep[];
  insights: PinnedInsight[];
  signals: AnomalySignal[];
  seal: AuditSeal | null;
  playbook: PlaybookResult | null;
  date?: Date;
}

const BG = "#010A19";
const TEAL = "#60F5D2";
const VIOLET = "#D6B2FC";
const TEXT = "#EEF2F7";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface ChartDatum {
  label: string;
  value: number;
}

function isDateLike(v: unknown): boolean {
  return v instanceof Date || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v));
}

/** نص عرض مناسب لأي قيمة (التواريخ تُعرض كتاريخ لا كطابع زمني). */
function labelText(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function chartData(rows: Row[]): ChartDatum[] {
  const first = rows[0];
  if (!first) return [];
  const cols = Object.keys(first);
  // العمود الرقمي يجب ألا يكون تاريخاً (وإلا ظهرت الطوابع الزمنية كقيم).
  const metric = cols.find(
    (c) => !isDateLike(first[c]) && typeof first[c] !== "boolean" && Number.isFinite(Number(first[c])),
  );
  const label = cols.find((c) => c !== metric);
  if (!metric || !label) {
    const lm = pickLabelMetric(rows);
    if (!lm) return [];
    return rows
      .slice(0, 12)
      .map((r) => ({ label: labelText(r[lm.label]), value: Number(r[lm.metric]) || 0 }))
      .filter((d) => Number.isFinite(d.value));
  }
  return rows
    .slice(0, 12)
    .map((r) => ({ label: labelText(r[label]), value: Number(r[metric]) || 0 }))
    .filter((d) => Number.isFinite(d.value));
}

/** رسم أعمدة SVG بسيط (لا مكتبات خارجية). */
function barSvg(data: ChartDatum[]): string {
  if (data.length === 0) return "";
  const w = 900;
  const h = 320;
  const pad = { t: 20, r: 20, b: 78, l: 20 };
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const bw = innerW / data.length;
  const bars = data
    .map((d, i) => {
      const bh = Math.max(2, (Math.abs(d.value) / max) * innerH);
      const x = pad.l + i * bw + bw * 0.18;
      const y = pad.t + innerH - bh;
      const cx = pad.l + i * bw + bw / 2;
      const label = d.label.length > 14 ? `${d.label.slice(0, 13)}…` : d.label;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${bh.toFixed(1)}" rx="8" fill="url(#g)"><title>${esc(d.label)}: ${esc(d.value)}</title></rect>
      <text x="${cx.toFixed(1)}" y="${(y - 7).toFixed(1)}" text-anchor="middle" font-size="12" fill="${TEAL}">${esc(
        Math.round(d.value * 100) / 100,
      )}</text>
      <text x="${cx.toFixed(1)}" y="${(pad.t + innerH + 18).toFixed(1)}" text-anchor="end" font-size="12" fill="#93A3BC" transform="rotate(-40 ${cx.toFixed(
        1,
      )} ${(pad.t + innerH + 18).toFixed(1)})">${esc(label)}</text>`;
    })
    .join("");
  return `<svg viewBox="0 0 ${w} ${h}" class="chart" role="img">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${TEAL}"/><stop offset="100%" stop-color="${VIOLET}" stop-opacity="0.55"/>
    </linearGradient></defs>${bars}</svg>`;
}

function table(rows: Row[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]!);
  const head = cols.map((c) => `<th>${esc(c)}</th>`).join("");
  const body = rows
    .slice(0, 200)
    .map((r) => `<tr>${cols.map((c) => `<td>${esc(r[c])}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function buildHtmlReport(input: HtmlReportInput): string {
  const date = input.date ?? new Date();
  const title = input.fileName.replace(/\.(csv|xlsx|xls)$/i, "");
  const dateStr = new Intl.DateTimeFormat("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  const kpis = [
    { label: "الصفوف", value: input.rowCount.toLocaleString("en-US") },
    { label: "الأعمدة", value: String(input.columnCount) },
    ...(input.health ? [{ label: "جودة البيانات", value: `${input.health.score}/100` }] : []),
    ...(input.playbook?.kpis.slice(0, 3).map((k) => ({ label: k.label, value: k.value })) ?? []),
  ].slice(0, 6);

  const kpiHtml = kpis
    .map(
      (k) => `<div class="card kpi"><span class="kpi-label">${esc(k.label)}</span>
      <strong class="kpi-value">${esc(k.value)}</strong></div>`,
    )
    .join("");

  const insightsHtml = input.insights
    .map((ins, i) => {
      const data = chartData(ins.rows);
      const highlights = ins.evidence.highlights
        .map((h) => `<span class="pill"><em>${esc(h.label)}</em> ${esc(h.value)}</span>`)
        .join("");
      return `<section class="card insight" data-search="${esc(ins.evidence.title.toLowerCase())}">
        <header><span class="num">${i + 1}</span><h3>${esc(ins.evidence.title)}</h3></header>
        <div class="pills">${highlights}</div>
        ${data.length ? barSvg(data) : ""}
        <details><summary>عرض جدول النتائج (${ins.rows.length} صف)</summary><div class="scroll">${table(ins.rows)}</div></details>
        <details><summary>عرض استعلام SQL</summary><pre dir="ltr" class="sql">${esc(ins.evidence.sql)}</pre></details>
      </section>`;
    })
    .join("");

  const signalsHtml = input.signals.length
    ? `<section class="card"><h2>رادار الإشارات الغريبة</h2><ul class="signals">${input.signals
        .map(
          (s) =>
            `<li class="lvl-${esc(s.level)}"><strong>${esc(s.title)}</strong><span>${esc(s.detail)}</span></li>`,
        )
        .join("")}</ul></section>`
    : "";

  const cleanHtml = input.cleanSteps.length
    ? `<section class="card"><h2>سجل التنظيف</h2><ol class="steps">${input.cleanSteps
        .map((s) => `<li>${esc(s.label)} <span class="muted">· ${s.affectedRows.toLocaleString("en-US")}</span></li>`)
        .join("")}</ol></section>`
    : "";

  const healthHtml = input.health
    ? `<section class="card"><h2>جودة البيانات</h2>
      <div class="grid">
        <div><span class="muted">الدرجة</span><strong>${input.health.score}/100</strong></div>
        <div><span class="muted">خلايا مفقودة</span><strong>${input.health.missingCells.toLocaleString("en-US")}</strong></div>
        <div><span class="muted">صفوف مكررة</span><strong>${input.health.duplicateRows.toLocaleString("en-US")}</strong></div>
        <div><span class="muted">أعمدة بأنواع مختلطة</span><strong>${input.health.mismatchedColumns}</strong></div>
      </div></section>`
    : "";

  const sealHtml = input.seal
    ? `<div class="seal"><strong>✅ ختم المصداقية — تحليل محلي موثّق</strong>
      <code dir="ltr">SHA-256: ${esc(input.seal.shortHash)}…</code>
      <span class="muted">${esc(new Date(input.seal.issuedAt).toLocaleString("ar-EG"))}</span></div>`
    : "";

  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — تقرير بصيرة التفاعلي</title>
<style>
  :root{--bg:${BG};--teal:${TEAL};--violet:${VIOLET};--text:${TEXT};--muted:#93A3BC;}
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(1200px 600px at 80% -10%, rgba(96,245,210,.10), transparent),
       radial-gradient(900px 500px at 10% 0%, rgba(214,178,252,.08), transparent),var(--bg);
       color:var(--text);font-family:"IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif;line-height:1.7}
  .wrap{max-width:1080px;margin:0 auto;padding:32px 20px 80px}
  header.top{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;
    background:rgba(255,255,255,.04);backdrop-filter:blur(18px);border:1px solid rgba(255,255,255,.09);
    border-radius:20px;padding:18px 22px;position:sticky;top:14px;z-index:5}
  h1{font-size:24px;margin:0}
  h2{font-size:18px;margin:0 0 12px}
  h3{font-size:16px;margin:0}
  .muted{color:var(--muted);font-size:13px}
  .card{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);border-radius:20px;
    padding:20px;margin-top:16px;backdrop-filter:blur(14px);box-shadow:0 18px 40px -30px rgba(0,0,0,.9)}
  .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-top:16px}
  .kpi{margin:0;display:flex;flex-direction:column;gap:6px}
  .kpi-label{color:var(--muted);font-size:12px}
  .kpi-value{font-size:26px;color:var(--teal);letter-spacing:-.02em}
  .insight header{display:flex;gap:10px;align-items:center;margin-bottom:10px}
  .num{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;font-size:13px;
    background:rgba(96,245,210,.12);color:var(--teal);border:1px solid rgba(96,245,210,.3)}
  .pills{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
  .pill{background:rgba(214,178,252,.10);border:1px solid rgba(214,178,252,.25);color:var(--violet);
    border-radius:999px;padding:4px 12px;font-size:13px}
  .pill em{color:var(--muted);font-style:normal;margin-inline-end:6px}
  .chart{width:100%;height:auto;margin:10px 0}
  details{margin-top:10px}
  summary{cursor:pointer;color:var(--teal);font-size:14px}
  .scroll{overflow:auto;max-height:420px;margin-top:10px}
  .tbl{width:100%;border-collapse:collapse;font-size:13px}
  .tbl th,.tbl td{border-bottom:1px solid rgba(255,255,255,.07);padding:7px 10px;text-align:start;white-space:nowrap}
  .tbl th{position:sticky;top:0;background:#08132a;color:var(--teal)}
  .sql{direction:ltr;text-align:left;background:rgba(0,0,0,.35);border-radius:12px;padding:12px;
    overflow:auto;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12.5px;color:#cfe6ff}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
  .grid div{display:flex;flex-direction:column;gap:4px}
  .grid strong{font-size:20px;color:var(--teal)}
  .signals{list-style:none;padding:0;margin:0;display:grid;gap:8px}
  .signals li{border-radius:14px;padding:10px 14px;background:rgba(255,255,255,.04);
    border-inline-start:3px solid var(--muted);display:flex;flex-direction:column}
  .signals li span{color:var(--muted);font-size:13px}
  .lvl-high{border-inline-start-color:#F97066}
  .lvl-medium{border-inline-start-color:#F5C978}
  .lvl-low{border-inline-start-color:var(--teal)}
  .steps{margin:0;padding-inline-start:20px}
  .seal{display:flex;flex-direction:column;gap:4px;border:1px solid rgba(96,245,210,.33);
    background:rgba(96,245,210,.06);border-radius:16px;padding:14px 18px;margin-top:16px}
  .seal code{font-size:12px;color:var(--muted)}
  input[type=search]{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.12);color:var(--text);
    border-radius:12px;padding:9px 14px;font:inherit;font-size:14px;min-width:220px}
  input[type=search]:focus{outline:none;border-color:var(--teal);box-shadow:0 0 0 3px rgba(96,245,210,.18)}
  footer{margin-top:32px;text-align:center;color:var(--muted);font-size:13px}
  @media print{body{background:#fff;color:#111} .card{break-inside:avoid}}
</style></head>
<body><div class="wrap">
  <header class="top">
    <div><h1>${esc(title)}</h1><span class="muted">تقرير تفاعلي مستقل · ${esc(dateStr)}${
      input.playbook && input.playbook.id !== "generic" ? ` · ${esc(input.playbook.name)}` : ""
    }</span></div>
    <input type="search" id="q" placeholder="🔍 فلترة الاستنتاجات…" aria-label="فلترة">
  </header>

  <div class="kpis">${kpiHtml}</div>
  ${healthHtml}
  ${signalsHtml}
  <div id="insights">${insightsHtml || '<section class="card"><p class="muted">لا توجد استنتاجات مثبّتة في هذا التقرير.</p></section>'}</div>
  ${cleanHtml}
  ${sealHtml}
  <footer>تم توليد هذا الملف محلياً بواسطة منصة بصيرة — لا يتصل بأي خادم ولا يحتاج إنترنت.</footer>
</div>
<script>
  var q = document.getElementById('q');
  q.addEventListener('input', function () {
    var v = q.value.trim().toLowerCase();
    document.querySelectorAll('.insight').forEach(function (el) {
      var hay = (el.getAttribute('data-search') || '') + ' ' + el.textContent.toLowerCase();
      el.style.display = !v || hay.indexOf(v) !== -1 ? '' : 'none';
    });
  });
</script>
</body></html>`;
}

export function downloadHtmlReport(input: HtmlReportInput) {
  const html = buildHtmlReport(input);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${input.fileName.replace(/\.[^.]+$/, "")}-بصيرة-تفاعلي.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
