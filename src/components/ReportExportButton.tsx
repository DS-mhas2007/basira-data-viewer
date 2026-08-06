/**
 * الوحدة 8: قائمة تصدير التقرير — تظهر بمجرد جاهزية البيانات (بلا اشتراط تثبيت استنتاجات).
 * كل خيار يفتح معاينة مباشرة للتقرير داخل المتصفح، والتنزيل يتم من داخل المعاينة.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase,
  ChevronDown,
  Download,
  FileCode,
  FileDown,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  ListChecks,
  Loader2,
  Microscope,
  Minus,
  Presentation,
  Plus,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PAGE_H, PAGE_W, ReportDocument, type ReportData } from "@/components/ReportDocument";
import { buildReportPdf, downloadPdfBlob } from "@/lib/pdf-report";
import { downloadPptx } from "@/lib/pptx-report";
import {
  downloadAllSectionPngs,
  downloadSectionPng,
  readReportSections,
  type ReportSection,
} from "@/lib/png-export";
import {
  audienceMeta,
  REPORT_AUDIENCES,
  REPORT_SECTIONS,
  reportFileName,
  sectionsNeedInsights,
  type PinnedInsight,
  type ReportAudience,
  type ReportSections,
} from "@/lib/report";
import { Checkbox } from "@/components/ui/checkbox";
import { generateAutoInsights } from "@/lib/auto-insights";
import { DATA_EXPORTS, exportCsv, exportXlsx, type DataExportFormat } from "@/lib/data-export";
import { downloadSqlBundle, downloadTopBottomXlsx } from "@/lib/report-format";
import { topBottomLists } from "@/lib/report-derive";
import { planAiQuery } from "@/lib/ai-query.functions";
import type { TableInfo } from "@/lib/duckdb-service";
import type { HealthReport } from "@/lib/data-health";
import type { Row } from "@/lib/parse-file";
import { downloadHtmlReport } from "@/lib/html-report";
import { playSfx } from "@/lib/sfx";
import type { AnomalySignal } from "@/lib/anomaly-radar";
import type { PlaybookResult } from "@/lib/playbooks";
import type { AuditSeal } from "@/lib/audit-seal";

interface Props {
  fileName: string;
  health: HealthReport | null;
  rowCount: number;
  columnCount: number;
  cleanSteps: ReportData["cleanSteps"];
  insights: PinnedInsight[];
  tableInfo: TableInfo | null;
  sample: Row[];
  /** جاهزية البيانات: الجدول محمَّل وفحص الجودة انتهى. */
  ready: boolean;
  /** ختم المصداقية الرقمي للملف الحالي. */
  seal?: ReportData["seal"];
  /** مدخلات التقرير التفاعلي المستقل (.html). */
  htmlContext?: { signals: AnomalySignal[]; playbook: PlaybookResult | null; seal: AuditSeal | null };
}

type Phase = "idle" | "analyzing" | "preparing" | "downloading" | "exporting" | "imaging";

/** حدود تكبير/تصغير المعاينة. */
const MIN_SCALE = 0.2;

export function ReportExportButton(props: Props) {
  const askAi = useServerFn(planAiQuery);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<ReportData | null>(null);
  const [label, setLabel] = useState("");
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [pngBusy, setPngBusy] = useState<string | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [pptxBusy, setPptxBusy] = useState(false);
  const [htmlBusy, setHtmlBusy] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(0.62);
  const [configOpen, setConfigOpen] = useState(false);
  const [custom, setCustom] = useState<ReportSections>(() => ({ ...audienceMeta("custom").sections }));
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // مقياس ملائم لعرض الحاوية حتى لا تظهر شريط تمرير أفقي على الشاشات الصغيرة.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth - 40;
      if (w > 0) setFitScale(Math.max(MIN_SCALE, Math.min(1, w / PAGE_W)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);

  const scale = Math.max(MIN_SCALE, Math.min(1.6, fitScale * zoom));

  // بعد رسم المستند داخل المعاينة نقرأ أقسامه لعرض أزرار تصدير الصور لكل قسم.
  useEffect(() => {
    if (!doc) {
      setSections([]);
      return;
    }
    const id = requestAnimationFrame(() => {
      const root = document.getElementById("basira-report-root");
      setSections(root ? readReportSections(root) : []);
    });
    return () => cancelAnimationFrame(id);
  }, [doc]);

  if (!props.ready) return null;
  const busy = phase !== "idle";
  const fileName = doc ? reportFileName(props.fileName, doc.date) : "";

  async function run(
    audience: ReportAudience,
    sections: ReportSections,
    mode: "preview" | "pptx" = "preview",
  ) {
    if (busy) return;
    setError(null);
    setDoc(null);
    setConfigOpen(false);
    const meta = audienceMeta(audience);
    let insights = props.insights;

    try {
      // توليد تلقائي فقط عند الحاجة — الأقسام التي لا تعتمد على الاستنتاجات لا تستدعي الذكاء الاصطناعي.
      if (sectionsNeedInsights(sections) && insights.length === 0 && props.tableInfo) {
        setPhase("analyzing");
        insights = await generateAutoInsights({
          askAi,
          tableInfo: props.tableInfo,
          sample: props.sample,
          health: props.health,
        });
        if (insights.length === 0) {
          setError("تعذّر توليد استنتاجات تلقائية. جرّب تقريراً بأقسام جودة البيانات فقط أو ثبّت استنتاجاً.");
          setPhase("idle");
          return;
        }
      }

      setPhase("preparing");
      setLabel(meta.label);
      const built: ReportData = {
        fileName: props.fileName,
        health: props.health,
        rowCount: props.rowCount,
        columnCount: props.columnCount,
        cleanSteps: props.cleanSteps,
        insights,
        date: new Date(),
        audience,
        sections,
        autoGenerated: insights !== props.insights,
        seal: props.seal ?? null,
      };
      if (mode === "pptx") {
        setPptxBusy(true);
        await downloadPptx(built);
        setPptxBusy(false);
      } else {
        setDoc(built);
      }
    } catch {
      setError("تعذّر إنشاء التقرير، حاول مرة أخرى.");
      setDoc(null);
      setPptxBusy(false);
    } finally {
      setPhase((p) => (p === "analyzing" ? "idle" : p === "preparing" ? "idle" : p));
    }
  }

  async function download() {
    if (!doc || phase === "downloading") return;
    setPhase("downloading");
    try {
      const root = document.getElementById("basira-report-root");
      if (!root) throw new Error("no-root");
      // إمهال إطار إضافي لضمان اكتمال رسم المخططات قبل التصوير.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      const blob = await buildReportPdf(root);
      downloadPdfBlob(blob, fileName);
    } catch {
      setError("تعذّر إنشاء ملف PDF، حاول مرة أخرى.");
    } finally {
      setPhase("idle");
    }
  }

  /** تصدير البيانات نفسها (CSV / Excel) مباشرة بلا معاينة. */
  async function runDataExport(format: DataExportFormat) {
    if (busy) return;
    setError(null);
    setPhase("exporting");
    try {
      const ctx = {
        fileName: props.fileName,
        columns: props.tableInfo?.schema.map((c) => c.name) ?? [],
        health: props.health,
        cleanSteps: props.cleanSteps,
        insights: props.insights,
      };
      if (format === "csv") await exportCsv(ctx);
      else await exportXlsx(ctx);
    } catch {
      setError("تعذّر تصدير البيانات، حاول مرة أخرى.");
    } finally {
      setPhase("idle");
    }
  }

  const pngBase = fileName.replace(/\.pdf$/i, "");

  async function savePng(section: ReportSection) {
    if (pngBusy) return;
    setPngBusy(String(section.index));
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      await downloadSectionPng(section, pngBase);
    } catch {
      setError("تعذّر تصدير الصورة، حاول مرة أخرى.");
    } finally {
      setPngBusy(null);
    }
  }

  async function saveAllPngs() {
    if (pngBusy || sections.length === 0) return;
    setPngBusy("all");
    try {
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      await downloadAllSectionPngs(sections, pngBase);
    } catch {
      setError("تعذّر تصدير الصور، حاول مرة أخرى.");
    } finally {
      setPngBusy(null);
    }
  }

  /** قوائم الأفضل/الأسوأ المشتقة من استنتاجات التقرير الحالي. */
  const rankedLists = doc ? topBottomLists(doc.insights) : [];

  async function saveListsXlsx() {
    if (!doc || listBusy || rankedLists.length === 0) return;
    setListBusy(true);
    try {
      await downloadTopBottomXlsx(rankedLists, props.fileName);
    } catch {
      setError("تعذّر تصدير ملف Excel، حاول مرة أخرى.");
    } finally {
      setListBusy(false);
    }
  }

  /** تصدير العرض التقديمي: شرائح أصلية قابلة للتعديل داخل PowerPoint. */
  async function savePptx() {
    if (!doc || pptxBusy) return;
    setPptxBusy(true);
    try {
      await downloadPptx(doc);
    } catch {
      setError("تعذّر إنشاء ملف PowerPoint، حاول مرة أخرى.");
    } finally {
      setPptxBusy(false);
    }
  }

  /** تقرير HTML تفاعلي مستقل يعمل بلا إنترنت. */
  async function saveHtml() {
    if (htmlBusy) return;
    setHtmlBusy(true);
    setError(null);
    try {
      let insights = props.insights;
      if (insights.length === 0 && props.tableInfo) {
        setPhase("analyzing");
        insights = await generateAutoInsights({
          askAi,
          tableInfo: props.tableInfo,
          sample: props.sample,
          health: props.health,
        });
      }
      setPhase("idle");
      downloadHtmlReport({
        fileName: props.fileName,
        health: props.health,
        rowCount: props.rowCount,
        columnCount: props.columnCount,
        cleanSteps: props.cleanSteps,
        insights,
        signals: props.htmlContext?.signals ?? [],
        seal: props.htmlContext?.seal ?? null,
        playbook: props.htmlContext?.playbook ?? null,
      });
      playSfx("export");
    } catch {
      setError("تعذّر إنشاء التقرير التفاعلي، حاول مرة أخرى.");
    } finally {
      setPhase("idle");
      setHtmlBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-end gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              data-tour="export"
              disabled={busy}
              className="clay-press h-10 gap-2 rounded-xl px-4"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2} />
              ) : (
                <FileDown className="size-4" strokeWidth={2} />
              )}
              {phase === "analyzing"
                ? "جاري تحليل البيانات..."
                : phase === "preparing"
                  ? "جاري تجهيز المعاينة..."
                  : phase === "exporting"
                    ? "جاري تجهيز الملف..."
                    : "تصدير"}
              {!busy && <ChevronDown className="size-4 opacity-70" strokeWidth={2} />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">تقرير PDF</DropdownMenuLabel>
            {REPORT_AUDIENCES.map((a) => (
              <DropdownMenuItem
                key={a.id}
                onSelect={() =>
                  a.id === "custom" ? setConfigOpen(true) : void run(a.id, a.sections)
                }
                className="flex-col items-start gap-0.5 py-2"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {a.id === "executive" ? (
                    <Briefcase className="size-3.5 text-accent" strokeWidth={2} />
                  ) : a.id === "analyst" ? (
                    <Microscope className="size-3.5 text-accent" strokeWidth={2} />
                  ) : a.id === "operational" ? (
                    <ListChecks className="size-3.5 text-accent" strokeWidth={2} />
                  ) : (
                    <SlidersHorizontal className="size-3.5 text-accent" strokeWidth={2} />
                  )}
                  {a.label}
                </span>
                <span className="text-xs text-muted-foreground">{a.audience} — {a.description}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">عرض تقديمي</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => void run("executive", audienceMeta("executive").sections, "pptx")}
              className="flex-col items-start gap-0.5 py-2"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Presentation className="size-3.5 text-accent" strokeWidth={2} />
                PowerPoint ‏(.pptx)
              </span>
              <span className="text-xs text-muted-foreground">
                شرائح 16:9 قابلة للتعديل — مؤشرات، رسوم أصلية، وتوصيات.
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">بيانات جدولية</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => void saveHtml()}
              className="flex-col items-start gap-0.5 py-2"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Globe className="size-3.5 text-accent" strokeWidth={2} />
                تقرير تفاعلي مستقل ‏(.html)
              </span>
              <span className="text-xs text-muted-foreground">
                ملف واحد يفتح في أي متصفح بلا إنترنت — فلترة، جداول، واستعلامات.
              </span>
            </DropdownMenuItem>
            {DATA_EXPORTS.map((d) => (
              <DropdownMenuItem
                key={d.id}
                onSelect={() => void runDataExport(d.id)}
                className="flex-col items-start gap-0.5 py-2"
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {d.id === "csv" ? (
                    <FileText className="size-3.5 text-accent" strokeWidth={2} />
                  ) : (
                    <FileSpreadsheet className="size-3.5 text-accent" strokeWidth={2} />
                  )}
                  {d.label}
                </span>
                <span className="text-xs text-muted-foreground">{d.description}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {error && <span className="max-w-[260px] text-end text-[11px] text-destructive">{error}</span>}
      </div>

      {/* اختيار الأقسام يدوياً — التقرير المخصص */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent dir="rtl" className="max-w-lg rounded-2xl">
          <DialogHeader className="text-start">
            <DialogTitle className="font-display text-base">تقرير مخصص</DialogTitle>
            <DialogDescription className="text-xs">
              اختر الأقسام التي تريد إظهارها. يمكنك البدء من قالب جاهز ثم التعديل عليه.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-2">
            {REPORT_AUDIENCES.filter((a) => a.id !== "custom").map((a) => (
              <Button
                key={a.id}
                type="button"
                size="sm"
                variant="secondary"
                className="clay-press h-7 rounded-lg px-2.5 text-[11px]"
                onClick={() => setCustom({ ...a.sections })}
              >
                قالب: {a.label}
              </Button>
            ))}
          </div>

          <div className="max-h-[46vh] space-y-1 overflow-y-auto pe-1">
            {REPORT_SECTIONS.map((sec) => (
              <label
                key={sec.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted/40"
              >
                <Checkbox
                  checked={custom[sec.id]}
                  onCheckedChange={(v) => setCustom((c) => ({ ...c, [sec.id]: v === true }))}
                  className="mt-0.5"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{sec.label}</span>
                  <span className="block text-xs text-muted-foreground">{sec.description}</span>
                </span>
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
            <span className="text-[11px] text-muted-foreground">
              {Object.values(custom).filter(Boolean).length} أقسام مفعّلة
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" className="clay-press rounded-xl" onClick={() => setConfigOpen(false)}>
                إلغاء
              </Button>
              <Button
                type="button"
                className="clay-press gap-2 rounded-xl"
                onClick={() => void run("custom", custom)}
              >
                <FileDown className="size-4" strokeWidth={2} />
                توليد التقرير
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={doc !== null} onOpenChange={(open) => !open && phase !== "downloading" && setDoc(null)}>
        <DialogContent
          dir="rtl"
          className="flex h-[94vh] max-w-[min(96vw,1040px)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[min(96vw,1040px)]"
        >
          {/* رأس النافذة */}
          <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 bg-card/40 px-5 py-4 pe-12 text-start">
            <DialogTitle className="flex flex-wrap items-center gap-2 font-display text-base sm:text-lg">
              معاينة التقرير
              <span className="rounded-lg bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">{label}</span>
              {sections.length > 0 && (
                <span className="rounded-lg bg-muted/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {sections.length} صفحات
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              معاينة مطابقة لصفحات ملف PDF، تُولَّد محلياً داخل متصفحك قبل التنزيل.
            </DialogDescription>
          </DialogHeader>

          {/* شريط أدوات: تصدير صور الأقسام + التكبير */}
          <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-background/40 px-5 py-2.5">
            <span className="hidden shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground sm:flex">
              <ImageIcon className="size-3.5 text-accent" strokeWidth={2} />
              صور الأقسام:
            </span>
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
              {sections.map((section) => (
                <Button
                  key={section.index}
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pngBusy !== null}
                  onClick={() => void savePng(section)}
                  className="clay-press h-7 shrink-0 gap-1.5 rounded-lg px-2.5 text-[11px]"
                >
                  {pngBusy === String(section.index) ? (
                    <Loader2 className="size-3 animate-spin" strokeWidth={2} />
                  ) : (
                    <Download className="size-3 text-accent" strokeWidth={2} />
                  )}
                  {section.title}
                </Button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border/60 bg-card/50 p-0.5">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-6 rounded-md"
                aria-label="تصغير"
                onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
              >
                <Minus className="size-3.5" strokeWidth={2} />
              </Button>
              <span className="w-10 text-center font-mono text-[11px] text-muted-foreground">
                {Math.round(scale * 100)}%
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-6 rounded-md"
                aria-label="تكبير"
                onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}
              >
                <Plus className="size-3.5" strokeWidth={2} />
              </Button>
            </div>
          </div>

          {/* حاوية التمرير: المستند نفسه هو مصدر التصوير عند التنزيل. */}
          <div ref={viewportRef} className="min-h-0 flex-1 overflow-auto bg-background/70 px-5 py-5">
            {doc && (
              <div dir="ltr" className="mx-auto" style={{ width: PAGE_W * scale }}>
                <div
                  id="basira-report-root"
                  className="[&_[data-pdf-page]]:mb-6 [&_[data-pdf-page]]:rounded-lg [&_[data-pdf-page]]:shadow-[var(--shadow-clay)]"
                  style={{
                    width: PAGE_W,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    marginBottom: -(PAGE_H * (1 - scale)),
                  }}
                >
                  <ReportDocument data={doc} />
                </div>
              </div>
            )}
          </div>

          {/* تذييل: اسم الملف + أزرار التنزيل */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-card/40 px-5 py-3">
            <span dir="ltr" className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
              {fileName}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="clay-press rounded-xl"
                disabled={phase === "downloading"}
                onClick={() => setDoc(null)}
              >
                إغلاق
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="clay-press gap-2 rounded-xl"
                disabled={phase === "downloading" || pngBusy !== null || sections.length === 0}
                onClick={() => void saveAllPngs()}
              >
                {pngBusy === "all" ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                ) : (
                  <ImageIcon className="size-4" strokeWidth={2} />
                )}
                {pngBusy === "all" ? "جاري تصدير الصور..." : "كل الأقسام PNG"}
              </Button>
            {doc && doc.sections.sql && doc.insights.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                className="clay-press gap-2 rounded-xl"
                disabled={phase === "downloading"}
                onClick={() => downloadSqlBundle(doc.insights, props.fileName)}
              >
                <FileCode className="size-4 text-accent" strokeWidth={2} />
                ملحق الاستعلامات .sql
              </Button>
            )}
            {doc && doc.sections.topBottom && rankedLists.length > 0 && (
              <Button
                type="button"
                variant="secondary"
                className="clay-press gap-2 rounded-xl"
                disabled={phase === "downloading" || listBusy}
                onClick={() => void saveListsXlsx()}
              >
                {listBusy ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                ) : (
                  <FileSpreadsheet className="size-4 text-accent" strokeWidth={2} />
                )}
                قوائم Top/Bottom (Excel)
              </Button>
            )}
              <Button
                type="button"
                variant="secondary"
                className="clay-press gap-2 rounded-xl"
                disabled={phase === "downloading" || pptxBusy}
                onClick={() => void savePptx()}
              >
                {pptxBusy ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Presentation className="size-4 text-accent" strokeWidth={2} />
                )}
                {pptxBusy ? "جاري بناء الشرائح..." : "عرض PowerPoint"}
              </Button>
              <Button
                type="button"
                className="clay-press gap-2 rounded-xl"
                disabled={phase === "downloading"}
                onClick={() => void download()}
              >
                {phase === "downloading" ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Download className="size-4" strokeWidth={2} />
                )}
                {phase === "downloading" ? "جاري إنشاء الملف..." : "تنزيل PDF"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
