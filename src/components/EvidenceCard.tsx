/**
 * الوحدة 6: بطاقة الدليل (Evidence Card).
 * عرض فقط — لا تغيير في منطق الوحدة 4 (OpenRouter) ولا في المدقق (الوحدة 5).
 */
import { useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Code2,
  Copy,
  Filter,
  ImageDown,
  Loader2,
  Lightbulb,
  Pencil,
  Pin,
  PinOff,
  Rows3,
  Table2,
} from "@/components/icons";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChartStudioModal } from "@/components/ChartStudioModal";
import { downloadBlob, toCsv } from "@/lib/data-export";
import { explainSql } from "@/lib/sql-explain";
import type { AiPlan } from "@/lib/ai-query.functions";
import type { Row } from "@/lib/parse-file";
import type { TableInfo } from "@/lib/duckdb-service";
import type { MetricLineage } from "@/lib/metric-lineage";
import { formatLineageDependencies } from "@/lib/lineage-display";

export interface HighlightMetric {
  label: string;
  value: string;
}

export interface EvidenceData {
  id: string;
  title: string;
  sql: string;
  filters: string[];
  baseRowCount: number | null;
  resultRowCount: number;
  highlights: HighlightMetric[];
  warnings: string[];
  sourceColumns?: { name: string; type: string; nullCount: number; nullRatio: number; castFailureCount?: number; castCheckedCount?: number; castTarget?: "DATE" | "TIMESTAMP" }[];
  lineage?: MetricLineage;
}

const SQL_KEYWORDS =
  /\b(SELECT|FROM|WHERE|GROUP\s+BY|ORDER\s+BY|LIMIT|WITH|AS|AND|OR|NOT|IN|IS|NULL|JOIN|LEFT|RIGHT|INNER|OUTER|ON|HAVING|DESC|ASC|CASE|WHEN|THEN|ELSE|END|DISTINCT|BETWEEN|LIKE|UNION|ALL)\b/gi;

function SqlHighlight({ sql }: { sql: string }) {
  const parts: { text: string; kw: boolean }[] = [];
  let last = 0;
  for (const m of sql.matchAll(SQL_KEYWORDS)) {
    const i = m.index ?? 0;
    if (i > last) parts.push({ text: sql.slice(last, i), kw: false });
    parts.push({ text: m[0], kw: true });
    last = i + m[0].length;
  }
  parts.push({ text: sql.slice(last), kw: false });
  return (
    <pre
      dir="ltr"
      className="overflow-x-auto rounded-xl border border-border/70 bg-surface-2 text-foreground p-3 text-left font-mono text-xs leading-relaxed"
    >
      {parts.map((p, i) => (
        <span key={i} className={p.kw ? "font-semibold text-primary" : "text-foreground/85"}>
          {p.text}
        </span>
      ))}
    </pre>
  );
}

function LineageDependencyGroup({
  label,
  columns,
  references,
}: {
  label: string;
  columns?: string[];
  references?: { table: string; column: string }[];
}) {
  const dependencies = formatLineageDependencies(columns, references);
  if (dependencies.length === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {dependencies.map((dependency) => (
          <span
            key={dependency}
            dir="ltr"
            className="rounded-md border border-border/60 bg-background/50 px-2 py-0.5 font-mono text-[10px] text-foreground/85"
          >
            {dependency}
          </span>
        ))}
      </div>
    </div>
  );
}

function Metric({ metric }: { metric: HighlightMetric }) {
  return (
    <div className="mz-glass-inset rounded-xl border border-border/70 bg-surface-2/55 px-4 py-3">
      <p className="font-mono text-2xl font-bold text-primary">{metric.value}</p>
      <p dir="auto" className="mt-1 truncate text-xs text-muted-foreground">
        {metric.label}
      </p>
    </div>
  );
}

interface Props {
  evidence: EvidenceData;
  plan: AiPlan;
  rows: Row[];
  chart: React.ReactNode;
  pinned: boolean;
  onPin: () => void;
  onUnpin?: () => void;
  /** يفعّل زر "تعديل الرسم" (استوديو التخصيص) عند توفره. */
  tableInfo?: TableInfo | null;
}

export function EvidenceCard({
  evidence,
  plan,
  rows,
  chart,
  pinned,
  onPin,
  onUnpin,
  tableInfo,
}: Props) {
  const [openSql, setOpenSql] = useState(false);
  const [openWhy, setOpenWhy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];
  const sourceColumns = evidence.sourceColumns ?? [];
  const intro = plan.intro_ar?.trim() ?? "";
  const analysis = plan.analysis_ar?.trim() ?? "";
  const steps = explainSql(evidence.sql);

  /** تصدير جدول النتيجة المعروض في البطاقة كملف CSV. */
  const exportRows = () => {
    if (columns.length === 0) return;
    const name =
      evidence.title.slice(0, 40).replace(/[\\/:*?"<>|]/g, "").trim() || "نتيجة";
    downloadBlob(
      new Blob(["\uFEFF" + toCsv(columns, rows)], { type: "text/csv;charset=utf-8" }),
      `MIZYAi-${name}.csv`,
    );
    toast.success("صُدِّر جدول النتيجة بصيغة CSV");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(evidence.sql);
      setCopied(true);
      toast.success("نُسخ استعلام SQL إلى الحافظة");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("تعذّر الوصول إلى حافظة الجهاز");
    }
  };

  /** حفظ الرسم البياني كصورة PNG محلياً (مناسب للعروض التقديمية). */
  const savePng = async () => {
    const node = chartRef.current;
    if (!node) return;
    setSaving(true);
    try {
      const { toPng } = await import("html-to-image");
      const raw = await toPng(node, {
        pixelRatio: 2,
        backgroundColor: "#FAF8F1",
        cacheBust: true,
      });
      // شريط الهوية السفلي (الشعار + MIZYAi) على نفس الخلفية الفاتحة للرسم.
      const { withBrandFooter } = await import("@/lib/brand-canvas");
      const url = await withBrandFooter(raw, {
        background: "#FAF8F1",
        hairline: "rgba(38,51,68,0.14)",
        lockup: "light",
        textColor: "#263344",
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${evidence.title.slice(0, 40).replace(/[\\/:*?"<>|]/g, "") || "chart"}.png`;
      a.click();
      toast.success("حُفظ الرسم صورةً بصيغة PNG");
    } catch {
      toast.error("تعذّر حفظ الصورة");
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="mz-glass-card mz-glass-card--dual space-y-5 rounded-[20px_10px_20px_10px] border border-border/80 bg-surface-1 px-4 py-4 sm:px-5 sm:py-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-display text-base font-bold leading-relaxed">{evidence.title}</h3>
        {/* إجراءات سريعة: صورة PNG · نسخ SQL · تثبيت */}
        <div role="group" aria-label="إجراءات الدليل" className="flex shrink-0 flex-wrap items-center gap-1.5">
          {columns.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={exportRows}
              title="تصدير جدول النتيجة CSV"
              aria-label="تصدير جدول النتيجة بصيغة CSV"
              className="clay-press h-9 gap-1.5 rounded-xl px-2.5 text-xs"
            >
              <Table2 className="size-4" strokeWidth={2} />
              <span className="hidden sm:inline">CSV</span>
            </Button>
          )}
          {tableInfo && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStudioOpen(true)}
              title="تعديل الرسم في الاستوديو"
              aria-label="تعديل الرسم في الاستوديو"
              className="clay-press h-9 gap-1.5 rounded-xl px-2.5 text-xs"
            >
              <Pencil className="size-4" strokeWidth={2} />
              <span className="hidden sm:inline">تعديل الرسم</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void savePng()}
            disabled={saving}
            title="حفظ الرسم كصورة PNG"
            aria-label={saving ? "جارٍ حفظ الرسم" : "حفظ الرسم كصورة PNG"}
            className="clay-press h-9 gap-1.5 rounded-xl px-2.5 text-xs"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            ) : (
              <ImageDown className="size-4" strokeWidth={2} />
            )}
            <span className="hidden sm:inline">PNG</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copy()}
            title="نسخ استعلام SQL"
            aria-label="نسخ استعلام SQL"
            className="clay-press h-9 gap-1.5 rounded-xl px-2.5 text-xs"
          >
            {copied ? (
              <Check className="size-4 text-primary" strokeWidth={2} />
            ) : (
              <Code2 className="size-4" strokeWidth={2} />
            )}
            <span className="hidden sm:inline">SQL</span>
          </Button>
          <Button
            type="button"
            variant={pinned ? "secondary" : "default"}
            size="sm"
            onClick={() => (pinned ? onUnpin?.() : onPin())}
            disabled={pinned && !onUnpin}
            title={pinned ? "إلغاء التثبيت" : "تثبيت في التقرير"}
            aria-label={pinned ? "إلغاء تثبيت الدليل من التقرير" : "تثبيت الدليل في التقرير"}
            className="clay-press h-9 gap-1.5 rounded-xl px-3 text-xs font-bold"
          >
            {pinned ? (
              <PinOff className="size-4" strokeWidth={2} />
            ) : (
              <Pin className="size-4" strokeWidth={2} />
            )}
            {pinned ? "مثبّت" : "تثبيت"}
          </Button>
        </div>
      </header>

      {intro && (
        <p dir="auto" className="text-sm leading-relaxed text-foreground/90">
          {intro}
        </p>
      )}

      {evidence.highlights.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {evidence.highlights.map((m, i) => (
            <Metric key={i} metric={m} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center gap-1.5 rounded-lg border border-border/70 bg-surface-2/55 px-2.5 py-1.5 text-muted-foreground">
          <Rows3 className="size-3.5 text-accent" strokeWidth={2} />
          صفوف المصدر (للاستعلام المباشر):{" "}
          <span className="font-mono text-foreground">
            {evidence.baseRowCount === null ? "—" : evidence.baseRowCount.toLocaleString("en-US")}
          </span>
        </span>
        <span className="clay-inset flex items-center gap-1.5 rounded-lg border border-border/70 px-2.5 py-1 text-muted-foreground">
          صفوف النتيجة:{" "}
          <span className="font-mono text-foreground">
            {evidence.resultRowCount.toLocaleString("en-US")}
          </span>
        </span>
      </div>

      {evidence.baseRowCount === null && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          هذا استعلام مركّب أو مفلتر؛ لا يمكن تحديد عدد الصفوف الداخلة في الحساب بدقة من بنيته وحدها.
        </p>
      )}

      {sourceColumns.length > 0 && (
        <section className="space-y-2 rounded-xl border border-border/70 bg-surface-2/45 px-4 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <AlertTriangle className="size-3.5 text-accent" strokeWidth={2} />
            جودة الأعمدة المصدرية المستخدمة
          </div>
          <div className="space-y-2">
            {sourceColumns.map((col) => (
              <div key={col.name} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span dir="auto" className="font-medium">{col.name}</span>
                <span className="text-muted-foreground">
                  {col.type} · {col.nullCount.toLocaleString("en-US")} قيمة مفقودة
                  {" "}({(col.nullRatio * 100).toFixed(1)}%)
                  {col.castFailureCount !== undefined && col.castCheckedCount !== undefined && (
                    <span className="block text-amber-700 dark:text-amber-300">
                      فشل تحويل {col.castTarget}: {col.castFailureCount.toLocaleString("en-US")} من {col.castCheckedCount.toLocaleString("en-US")} قيمة غير فارغة في كامل المصدر
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            أعداد القيم المفقودة محسوبة على العمود في مجموعة البيانات كاملة، وليست بالضرورة عدد الصفوف المستبعدة من هذا الاستعلام.
          </p>
        </section>
      )}

      {evidence.lineage && (
        <section className="space-y-3 rounded-xl border border-primary/20 bg-surface-2/45 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <Rows3 className="size-3.5 text-primary" strokeWidth={2} />
              مسار اشتقاق المقاييس
            </div>
            <span className="rounded-md border border-border/70 px-2 py-1 text-[10px] text-muted-foreground">
              {evidence.lineage.status === "complete" ? "تتبّع مباشر" : evidence.lineage.status === "partial" ? "تتبّع جزئي" : "غير مدعوم"}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            المصدر: <span dir="ltr" className="font-mono">{evidence.lineage.sourceTable}</span>
            {" · "}الثقة: {evidence.lineage.confidence === "high" ? "مرتفعة" : evidence.lineage.confidence === "medium" ? "متوسطة" : "منخفضة"}
          </p>

          {evidence.lineage.executionPlan && (
            <div className="space-y-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                <span className="text-primary">خطة التنفيذ الفعلية من DuckDB</span>
                <span className="rounded-md border border-border/70 px-1.5 py-0.5 font-normal text-muted-foreground">Physical Plan</span>
              </div>
              {evidence.lineage.executionPlan.operators.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {evidence.lineage.executionPlan.operators.map((operator) => (
                    <span key={operator} dir="ltr" className="rounded-md bg-primary/10 px-2 py-1 font-mono text-[10px]">{operator}</span>
                  ))}
                </div>
              )}
              {evidence.lineage.executionPlan.scannedTables.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  الجداول المقروءة: <span dir="ltr" className="font-mono text-foreground">{evidence.lineage.executionPlan.scannedTables.join("، ")}</span>
                </p>
              )}
              {evidence.lineage.executionPlan.filters.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-semibold text-muted-foreground">مرشحات المحرك</p>
                  {evidence.lineage.executionPlan.filters.slice(0, 5).map((filter, index) => (
                    <code key={index} dir="ltr" className="block break-all text-left text-[10px] text-foreground/80">{filter}</code>
                  ))}
                </div>
              )}
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                هذه معلومات من خطة DuckDB الفيزيائية؛ لا تُعامل وحدها كإثبات لارتباط كل عمود بمصدره.
              </p>
            </div>
          )}
          {evidence.lineage.outputColumns.length > 0 && (
            <div className="space-y-2">
              {evidence.lineage.outputColumns.slice(0, 12).map((column) => (
                <div key={column.outputName} className="rounded-lg border border-border/60 bg-background/35 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span dir="auto" className="text-xs font-semibold">{column.outputName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {column.role === "metric" ? "مقياس" : column.role === "dimension" ? "بُعد" : column.role === "derived" ? "مشتق" : "غير محدد"}
                    </span>
                  </div>
                  <code dir="ltr" className="mt-1 block break-all text-left text-[11px] text-primary">{column.expression}</code>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {column.sourceColumns.map((name) => (
                      <span key={name} dir="auto" className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px]">{name}</span>
                    ))}
                    {column.operations.map((operation) => (
                      <span key={operation} className="rounded-md bg-accent/10 px-2 py-0.5 text-[10px] text-accent">{operation}</span>
                    ))}
                  </div>
                  <LineageDependencyGroup
                    label="مصادر القيمة"
                    columns={column.valueSourceColumns}
                    references={column.valueSourceReferences}
                  />
                  <LineageDependencyGroup
                    label="شروط CASE"
                    columns={column.conditionSourceColumns}
                    references={column.conditionSourceReferences}
                  />
                  <LineageDependencyGroup
                    label="اعتماديات عضوية الصفوف"
                    columns={column.rowFilterSourceColumns}
                    references={column.rowFilterSourceReferences}
                  />
                </div>
              ))}
            </div>
          )}
          {evidence.lineage.operations.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {evidence.lineage.operations.map((operation, index) => (
                <span key={`${operation.kind}-${index}`} className="rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground">
                  {operation.label}
                </span>
              ))}
            </div>
          )}
          {evidence.lineage.warnings.length > 0 && (
            <ul className="list-disc space-y-1 ps-4 text-[11px] text-amber-700 dark:text-amber-300">
              {evidence.lineage.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
            </ul>
          )}
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            هذا تتبّع اعتماديات ساكن وبنيوي من SQL والمخطط النشط؛ يوضح مواضع استخدام الأعمدة لكنه لا يثبت السببية أو التكافؤ الدلالي أو صحة تعريف الأعمال أو صحة علاقات JOIN.
          </p>
        </section>
      )}

      {evidence.filters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="size-3.5 text-accent" strokeWidth={2} />
            الفلاتر المطبقة:
          </span>
          {evidence.filters.map((f, i) => (
            <span
              key={i}
              dir="ltr"
              className="rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-[11px] text-accent"
            >
              {f}
            </span>
          ))}
        </div>
      )}

      <div ref={chartRef}>{chart}</div>

      {tableInfo && (
        <ChartStudioModal
          open={studioOpen}
          onOpenChange={setStudioOpen}
          tableInfo={tableInfo}
          seedTitle={evidence.title}
        />
      )}

      {analysis && (
        <div className="rounded-xl border border-border/70 bg-surface-2/55 px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="font-semibold text-foreground">تفسير مساعد مولّد آلياً</span>
            <span className="rounded-md border border-accent/25 bg-accent/5 px-2 py-0.5 text-accent">قراءة وصفية</span>
          </div>
          <p
            dir="auto"
            className="text-sm leading-relaxed text-muted-foreground [&>strong]:text-foreground"
          >
            {analysis}
          </p>
        </div>
      )}

      <aside
        role="note"
        aria-label="حدود تفسير النتيجة"
        className="rounded-xl border border-border/60 bg-background/35 px-4 py-3 text-xs leading-6 text-muted-foreground"
      >
        <strong className="font-semibold text-foreground">حدود الاستدلال:</strong>{" "}
        القيم والصفوف المعروضة مرتبطة باستعلام SQL المنفّذ. هذا الملخص وصفي؛ لا يُعد اختبار دلالة إحصائية ولا يثبت علاقة سببية.
      </aside>

      {columns.length > 0 && (
        <div className="clay-inset max-h-80 overflow-auto rounded-xl border border-border/70">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card/95 backdrop-blur">
              <tr>
                {columns.map((c) => (
                  <th
                    key={c}
                    dir="ltr"
                    className="px-3 py-2 text-right font-mono text-xs font-semibold text-muted-foreground"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-border/50">
                  {columns.map((c) => (
                    <td key={c} dir="auto" className="px-3 py-2 font-mono text-xs">
                      {r[c] === null ? "—" : String(r[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpenSql((v) => !v)}
            className="clay-press flex flex-1 items-center gap-2 rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm transition hover:border-primary/50"
            aria-expanded={openSql}
          >
            <Code2 className="size-4 text-primary" strokeWidth={2} />
            عرض الاستعلام SQL
            <ChevronDown
              className={`ms-auto size-4 text-muted-foreground transition-transform ${openSql ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void copy()}
            className="clay-press h-9 gap-2 rounded-xl"
          >
            {copied ? (
              <Check className="size-4 text-primary" strokeWidth={2} />
            ) : (
              <Copy className="size-4" strokeWidth={2} />
            )}
            {copied ? "تم النسخ" : "نسخ"}
          </Button>
        </div>
        {openSql && <SqlHighlight sql={evidence.sql} />}
      </div>

      {steps.length > 0 && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setOpenWhy((v) => !v)}
            className="clay-press flex w-full items-center gap-2 rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-sm transition hover:border-accent/50"
            aria-expanded={openWhy}
          >
            <Lightbulb className="size-4 text-accent" strokeWidth={2} />
            كيف فكّرت MIZYAi؟
            <ChevronDown
              className={`ms-auto size-4 text-muted-foreground transition-transform ${openWhy ? "rotate-180" : ""}`}
              strokeWidth={2}
            />
          </button>
          {openWhy && (
            <ol className="clay-inset space-y-2.5 rounded-xl border border-border/70 bg-background/40 px-4 py-3">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-accent/15 font-mono text-[11px] font-bold text-accent">
                    {i + 1}
                  </span>
                  <span dir="auto" className="text-xs leading-relaxed">
                    <span className="font-semibold text-foreground">{s.title}: </span>
                    <span className="text-muted-foreground">{s.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {evidence.warnings.length > 0 && (
        <ul className="space-y-1.5">
          {evidence.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-[#F5C978]" strokeWidth={2} />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
