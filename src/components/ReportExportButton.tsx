/**
 * الوحدة 8: قائمة تصدير التقرير — تظهر بمجرد جاهزية البيانات (بلا اشتراط تثبيت استنتاجات).
 * كل خيار يفتح معاينة مباشرة للتقرير داخل المتصفح، والتنزيل يتم من داخل المعاينة.
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
  Globe,
  Presentation,
  Plus,
  SlidersHorizontal,
  type LucideIcon,
} from "@/components/icons";
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
import { lazy, Suspense } from "react";
import type { ReportData } from "@/components/ReportDocument";
import { PAGE_H, PAGE_W } from "@/lib/report-page";

const ReportDocument = lazy(() =>
  import("@/components/ReportDocument").then((m) => ({ default: m.ReportDocument })),
);
import {
  REPORT_THEMES,
  readStoredReportTheme,
  storeReportTheme,
  type ReportThemeId,
} from "@/lib/report-theme";
import {
  REPORT_TEMPLATES,
  readStoredReportTemplate,
  storeReportTemplate,
  type ReportTemplateId,
} from "@/lib/report-template";
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
import { useServerFn } from "@tanstack/react-start";
import { generateReportNarratives } from "@/lib/report-narrative.functions";
import { buildNarrativeFacts, validateNarrations } from "@/lib/report-narrative";
import { useCloudAiConsent } from "@/lib/cloud-ai-consent.tsx";
import {
  DATA_EXPORTS,
  EXPORT_ROW_LIMIT,
  exportCsv,
  exportXlsx,
  type DataExportFormat,
} from "@/lib/data-export";
import { CODE_EXPORTS, downloadCode, type CodeFormat } from "@/lib/code-export";
import { downloadSqlBundle, downloadTopBottomXlsx } from "@/lib/report-format";
import { topBottomLists } from "@/lib/report-derive";
import type { TableInfo } from "@/lib/duckdb-service";
import type { HealthReport } from "@/lib/data-health";
import type { Row } from "@/lib/parse-file";
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
  /** سجل اتساق المصدر والتحويل والناتج المحلي. */
  seal?: ReportData["seal"];
  /** مدخلات التقرير التفاعلي المستقل (.html). */
  htmlContext?: {
    signals: AnomalySignal[];
    playbook: PlaybookResult | null;
    seal: AuditSeal | null;
  };
}

type Phase = "idle" | "analyzing" | "preparing" | "downloading" | "exporting" | "imaging";

function warnPptxLimits(insights: PinnedInsight[], sections: ReportSections) {
  const warnings: string[] = [];
  if (sections.headline && insights.length > 5)
    warnings.push(`ملخص الاستنتاجات يعرض أول 5 من أصل ${insights.length}`);
  if (sections.insights && insights.length > 10)
    warnings.push(`صفحات التفاصيل تعرض أول 10 من أصل ${insights.length}`);
  if (sections.insights && insights.some((insight) => insight.rows.length > 12))
    warnings.push("يعرض كل مخطط أول 12 نقطة فقط");
  if (warnings.length) toast.warning(`حدود PowerPoint: ${warnings.join("؛ ")}.`);
}

/** عنصر تصدير موحّد: أيقونة + عنوان + شارة الصيغة + وصف مختصر. */
function ExportItem({
  icon: Icon,
  title,
  badge,
  description,
  onSelect,
}: {
  icon: LucideIcon;
  title: string;
  badge: string;
  description: string;
  onSelect: () => void;
}) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="flex-col items-stretch gap-0.5 py-2">
      <span className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-3.5 shrink-0 text-accent" strokeWidth={2} />
        <span className="flex-1 truncate">{title}</span>
        <span
          className="rounded border border-border/60 bg-muted/40 px-1.5 py-px font-mono text-[10px] text-muted-foreground"
          dir="ltr"
        >
          {badge}
        </span>
      </span>
      <span className="line-clamp-2 text-xs leading-5 text-muted-foreground">{description}</span>
    </DropdownMenuItem>
  );
}

/** حدود تكبير/تصغير المعاينة. */
const MIN_SCALE = 0.2;

export function ReportExportButton(props: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  /** إجراء بديل يُعرض مع الخطأ (مثلاً: تقرير الجودة فقط). */
  const [errorAction, setErrorAction] = useState<{ label: string; run: () => void } | null>(null);
  const [doc, setDoc] = useState<ReportData | null>(null);
  const [label, setLabel] = useState("");
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [pngBusy, setPngBusy] = useState<string | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [pptxBusy, setPptxBusy] = useState(false);
  const [htmlBusy, setHtmlBusy] = useState(false);
  const [theme, setThemeState] = useState<ReportThemeId>(() => readStoredReportTheme());
  const setTheme = (id: ReportThemeId) => {
    setThemeState(id);
    storeReportTheme(id);
    // تبديل فوري للمعاينة المفتوحة.
    setDoc((d) => (d ? { ...d, theme: id } : d));
  };
  const [template, setTemplateState] = useState<ReportTemplateId>(() => readStoredReportTemplate());
  const setTemplate = (id: ReportTemplateId) => {
    setTemplateState(id);
    storeReportTemplate(id);
    setDoc((d) => (d ? { ...d, template: id } : d));
  };
  const narrate = useServerFn(generateReportNarratives);
  const { cloudAiConsent } = useCloudAiConsent();
  const [aiNarration, setAiNarrationState] = useState(false);
  useEffect(() => {
    try {
      setAiNarrationState(localStorage.getItem("mizya.report.ai-narration") === "1");
    } catch {
      /* التخزين غير متاح */
    }
  }, []);
  const setAiNarration = (on: boolean) => {
    setAiNarrationState(on);
    try {
      localStorage.setItem("mizya.report.ai-narration", on ? "1" : "0");
    } catch {
      /* تجاهل */
    }
  };
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [fitScale, setFitScale] = useState(0.62);
  const [configOpen, setConfigOpen] = useState(false);
  const [custom, setCustom] = useState<ReportSections>(() => ({
    ...audienceMeta("custom").sections,
  }));
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
    setErrorAction(null);
    setDoc(null);
    setConfigOpen(false);
    const meta = audienceMeta(audience);
    let insights = props.insights;

    try {
      // استنتاجات قياسية تُبنى محلياً (بلا ذكاء اصطناعي ولا تسجيل دخول) عند غياب المثبَّتة.
      if (sectionsNeedInsights(sections) && insights.length === 0 && props.tableInfo) {
        setPhase("analyzing");
        insights = await (
          await import("@/lib/auto-insights")
        ).buildLocalInsights(props.tableInfo, props.health);
        if (insights.length === 0) {
          const qualityOnly = Object.fromEntries(
            REPORT_SECTIONS.map((sec) => [sec.id, !sec.needsInsights]),
          ) as ReportSections;
          setError(
            "لم أجد في بياناتك أعمدة تكفي لبناء استنتاجات قياسية (يلزم عمود رقمي أو فئوي). ثبّت استنتاجاً من «اسأل MIZYAi»، أو أنشئ تقرير الجودة وحده.",
          );
          setErrorAction({
            label: "إنشاء تقرير الجودة فقط",
            run: () => void run("custom", qualityOnly),
          });
          setPhase("idle");
          return;
        }
      }

      // صياغة سردية اختيارية: تُقبل فقط النصوص التي كل أرقامها موجودة في نتيجة التحليل.
      const pb = props.htmlContext?.playbook;
      const domainId = pb && pb.confidence >= 0.5 && pb.id !== "generic" ? pb.id : undefined;
      let aiNarratedIds: string[] = [];
      if (aiNarration && insights.length > 0 && sectionsNeedInsights(sections)) {
        setPhase("analyzing");
        try {
          const facts = buildNarrativeFacts(
            insights.map((ins) => ({
              id: ins.evidence.id,
              title: ins.evidence.title,
              baseRowCount: ins.evidence.baseRowCount,
              resultRowCount: ins.evidence.resultRowCount,
              highlights: ins.evidence.highlights,
              rows: ins.rows,
            })),
          );
          const res = await narrate({
            data: { actionId: crypto.randomUUID(), cloudAiConsent, items: facts },
          });
          if (res.ok) {
            const { accepted, rejected } = validateNarrations(res.narrations, facts);
            aiNarratedIds = Object.keys(accepted);
            insights = insights.map((ins) =>
              accepted[ins.evidence.id]
                ? { ...ins, plan: { ...ins.plan, analysis_ar: accepted[ins.evidence.id]! } }
                : ins,
            );
            if (rejected.length > 0)
              toast.info(
                `استُخدم النص المحلي في ${rejected.length} استنتاج(ات) لأن صياغة الذكاء الاصطناعي لم تطابق الأرقام.`,
              );
          } else {
            toast.warning(`${res.error} (استُخدم النص المحلي)`);
          }
        } catch {
          toast.warning("تعذّرت الصياغة الذكية (قد يلزم تسجيل الدخول). استُخدم النص المحلي.");
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
        autoGenerated: props.insights.length === 0,
        aiNarratedIds,
        ...(domainId ? { domain: domainId } : {}),
        seal: props.seal ?? null,
        theme,
        template,
      };
      if (mode === "pptx") {
        setPptxBusy(true);
        await (await import("@/lib/pptx-report")).downloadPptx(built);
        warnPptxLimits(built.insights, built.sections);
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
      const { buildReportPdf, downloadPdfBlob } = await import("@/lib/pdf-report");
      const blob = await buildReportPdf(root, {
        title: `${props.fileName} — ${label}`,
        keywords: ["MIZYAi", label, props.fileName],
        onProgress: (done, total) => setPdfProgress({ done, total }),
      });
      downloadPdfBlob(blob, fileName);
    } catch {
      setError("تعذّر إنشاء ملف PDF، حاول مرة أخرى.");
    } finally {
      setPdfProgress(null);
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
      const exportedRows = format === "csv" ? await exportCsv(ctx) : await exportXlsx(ctx);
      if (exportedRows < props.rowCount) {
        toast.warning(
          `تم تصدير أول ${exportedRows.toLocaleString("ar-EG")} صف من أصل ${props.rowCount.toLocaleString("ar-EG")}؛ الحد الوقائي ${EXPORT_ROW_LIMIT.toLocaleString("ar-EG")} صف.`,
        );
      } else {
        toast.success(`تم تصدير ${exportedRows.toLocaleString("ar-EG")} صفاً.`);
      }
    } catch {
      setError("تعذّر تصدير البيانات، حاول مرة أخرى.");
    } finally {
      setPhase("idle");
    }
  }

  const pngBase = fileName.replace(/\.pdf$/i, "");

  /** تصدير الكود (Python / SQL) الذي يعيد إنتاج نفس المعالجة خارج MIZYAi. */
  function runCodeExport(format: CodeFormat) {
    setError(null);
    try {
      downloadCode(format, {
        fileName: props.fileName,
        cleanSteps: props.cleanSteps,
        insights: props.insights,
      });
    } catch {
      setError("تعذّر تصدير الكود، حاول مرة أخرى.");
    }
  }

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
      await (await import("@/lib/pptx-report")).downloadPptx(doc);
      warnPptxLimits(doc.insights, doc.sections);
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
        insights = await (
          await import("@/lib/auto-insights")
        ).buildLocalInsights(props.tableInfo, props.health);
      }
      setPhase("idle");
      await (
        await import("@/lib/html-report")
      ).downloadHtmlReport({
        fileName: props.fileName,
        health: props.health,
        rowCount: props.rowCount,
        columnCount: props.columnCount,
        cleanSteps: props.cleanSteps,
        insights,
        signals: props.htmlContext?.signals ?? [],
        seal: props.htmlContext?.seal ?? null,
        playbook: props.htmlContext?.playbook ?? null,
        theme,
        template,
      });
      if (insights.some((insight) => insight.rows.length > 200)) {
        toast.warning(
          "تقرير HTML يعرض أول 200 صف فقط في جدول كل استنتاج، ويذكر العدد الكلي داخل الملف.",
        );
      } else if (insights.some((insight) => insight.rows.length > 12)) {
        toast.warning(
          "رسوم تقرير HTML تعرض أول 12 نقطة من كل نتيجة؛ جدول النتائج يعرض حتى 200 صف.",
        );
      }
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
              className="mz-glass-card mz-glass-card--teal h-10 gap-2 rounded-xl px-4"
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
          <DropdownMenuContent
            align="end"
            className="mz-glass-card mz-glass-card--neutral max-h-[75vh] w-80 overflow-y-auto"
          >
            <p className="px-2 pb-1 pt-1.5 text-[11px] leading-5 text-muted-foreground">
              كل التصدير يتم داخل متصفحك، بلا رفع للملف ولا حاجة لتسجيل الدخول.
            </p>
            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
              مظهر التقرير (PDF / PowerPoint / HTML)
            </DropdownMenuLabel>
            <div
              className="grid grid-cols-2 gap-1.5 px-1.5 pb-1.5"
              role="radiogroup"
              aria-label="مظهر التقرير"
            >
              {Object.values(REPORT_THEMES).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={theme === t.id}
                  onClick={() => setTheme(t.id)}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-start text-xs transition-colors ${
                    theme === t.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <span
                    className="size-5 shrink-0 rounded-md border"
                    style={{
                      background: t.page,
                      borderColor: t.accent,
                      boxShadow: `inset -6px 0 0 ${t.accent}`,
                    }}
                  />
                  <span className="leading-4">{t.label}</span>
                </button>
              ))}
            </div>
            <p className="px-2 pb-1 text-[10.5px] leading-4 text-muted-foreground">
              {REPORT_THEMES[theme].description}
            </p>
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
              قالب التقرير (PDF / PowerPoint)
            </DropdownMenuLabel>
            <div
              className="grid grid-cols-2 gap-1.5 px-1.5 pb-1.5"
              role="radiogroup"
              aria-label="قالب التقرير"
            >
              {Object.values(REPORT_TEMPLATES).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={template === t.id}
                  onClick={() => setTemplate(t.id)}
                  className={`rounded-lg border px-2 py-1.5 text-start text-xs transition-colors ${
                    template === t.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="px-2 pb-1 text-[10.5px] leading-4 text-muted-foreground">
              {REPORT_TEMPLATES[template].description}
            </p>
            <DropdownMenuSeparator />

            <label className="flex cursor-pointer items-start gap-2 px-2 py-1.5 text-xs">
              <Checkbox
                checked={aiNarration}
                onCheckedChange={(v) => setAiNarration(v === true)}
                className="mt-0.5"
              />
              <span className="leading-5">
                صياغة النص بالذكاء الاصطناعي
                <span className="block text-[10.5px] leading-4 text-muted-foreground">
                  اختياري: يُرسل ملخص نتائج الاستنتاجات فقط (لا الملف). تُرفض أي صياغة فيها رقم غير
                  مطابق للأدلة، ويلزم تسجيل الدخول وإذن AI سحابي.
                </span>
              </span>
            </label>
            <DropdownMenuSeparator />

            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
              تقارير للقراءة والطباعة
            </DropdownMenuLabel>
            {REPORT_AUDIENCES.map((a) => (
              <ExportItem
                key={a.id}
                icon={
                  a.id === "executive"
                    ? Briefcase
                    : a.id === "analyst"
                      ? Microscope
                      : a.id === "operational"
                        ? ListChecks
                        : SlidersHorizontal
                }
                title={a.label}
                badge={a.id === "custom" ? "اختيار" : "PDF"}
                description={`${a.audience} — ${a.description}`}
                onSelect={() =>
                  a.id === "custom" ? setConfigOpen(true) : void run(a.id, a.sections)
                }
              />
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
              عروض وتقارير تفاعلية
            </DropdownMenuLabel>
            <ExportItem
              icon={Presentation}
              title="عرض تقديمي"
              badge="PPTX"
              description="شرائح 16:9 قابلة للتعديل: مؤشرات، رسوم أصلية، وتوصيات."
              onSelect={() => void run("executive", audienceMeta("executive").sections, "pptx")}
            />
            <ExportItem
              icon={Globe}
              title="تقرير تفاعلي مستقل"
              badge="HTML"
              description="ملف واحد يفتح في أي متصفح بلا إنترنت: فلترة وجداول واستعلامات."
              onSelect={() => void saveHtml()}
            />

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
              البيانات نفسها
            </DropdownMenuLabel>
            {DATA_EXPORTS.map((d) => (
              <ExportItem
                key={d.id}
                icon={d.id === "csv" ? FileText : FileSpreadsheet}
                title={d.label.replace(/^تصدير\s*/, "")}
                badge={d.id.toUpperCase()}
                description={d.description}
                onSelect={() => void runDataExport(d.id)}
              />
            ))}

            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
              كود لإعادة التحليل خارج MIZYAi
            </DropdownMenuLabel>
            {CODE_EXPORTS.map((c) => (
              <ExportItem
                key={c.id}
                icon={FileCode}
                title={c.label.replace(/^تصدير\s*كود\s*/, "كود ")}
                badge={c.id === "python" ? "PY" : c.id.toUpperCase()}
                description={c.description}
                onSelect={() => runCodeExport(c.id)}
              />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {error && (
          <div
            role="alert"
            className="max-w-[300px] space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-end text-[11px] leading-5 text-destructive"
          >
            <p>{error}</p>
            <div className="flex flex-wrap justify-end gap-1.5">
              {errorAction && (
                <button
                  type="button"
                  onClick={() => {
                    const act = errorAction;
                    setError(null);
                    setErrorAction(null);
                    act.run();
                  }}
                  className="rounded-md border border-destructive/40 bg-background/60 px-2 py-0.5 font-medium text-foreground hover:bg-background"
                >
                  {errorAction.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setErrorAction(null);
                }}
                className="rounded-md px-2 py-0.5 text-muted-foreground hover:text-foreground"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}
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
                className="h-7 rounded-lg px-2.5 text-[11px]"
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
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                onClick={() => setConfigOpen(false)}
              >
                إلغاء
              </Button>
              <Button
                type="button"
                className="gap-2 rounded-xl"
                onClick={() => void run("custom", custom)}
              >
                <FileDown className="size-4" strokeWidth={2} />
                توليد التقرير
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={doc !== null}
        onOpenChange={(open) => !open && phase !== "downloading" && setDoc(null)}
      >
        <DialogContent
          dir="rtl"
          className="flex h-[94vh] max-w-[min(96vw,1040px)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-[min(96vw,1040px)]"
        >
          {/* رأس النافذة */}
          <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 bg-card/40 px-5 py-4 pe-12 text-start">
            <DialogTitle className="flex flex-wrap items-center gap-2 font-display text-base sm:text-lg">
              معاينة التقرير
              <span className="rounded-lg bg-accent/15 px-2 py-0.5 text-[11px] font-medium text-accent">
                {label}
              </span>
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
                  className="h-7 shrink-0 gap-1.5 rounded-lg px-2.5 text-[11px]"
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
          <div
            ref={viewportRef}
            className="min-h-0 flex-1 overflow-auto bg-background/70 px-5 py-5"
          >
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
                  <Suspense
                    fallback={
                      <div className="p-10 text-center text-sm text-muted-foreground">
                        جارٍ تحميل المعاينة…
                      </div>
                    }
                  >
                    <ReportDocument data={doc} />
                  </Suspense>
                </div>
              </div>
            )}
          </div>

          {/* تذييل: اسم الملف + أزرار التنزيل */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-card/40 px-5 py-3">
            <span
              dir="ltr"
              className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground"
            >
              {fileName}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                disabled={phase === "downloading"}
                onClick={() => setDoc(null)}
              >
                إغلاق
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-2 rounded-xl"
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
                  className="gap-2 rounded-xl"
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
                  className="gap-2 rounded-xl"
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
              <div
                className="flex items-center gap-1 rounded-xl border border-border p-0.5"
                role="radiogroup"
                aria-label="مظهر التقرير"
              >
                {Object.values(REPORT_THEMES).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={(doc?.theme ?? theme) === t.id}
                    onClick={() => setTheme(t.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                      (doc?.theme ?? theme) === t.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div
                className="flex items-center gap-1 rounded-xl border border-border p-0.5"
                role="radiogroup"
                aria-label="قالب التقرير"
              >
                {Object.values(REPORT_TEMPLATES).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={(doc?.template ?? template) === t.id}
                    onClick={() => setTemplate(t.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                      (doc?.template ?? template) === t.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                className="gap-2 rounded-xl"
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
                className="gap-2 rounded-xl"
                disabled={phase === "downloading"}
                onClick={() => void download()}
              >
                {phase === "downloading" ? (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                ) : (
                  <Download className="size-4" strokeWidth={2} />
                )}
                {phase === "downloading"
                  ? pdfProgress
                    ? `جاري إنشاء الملف… ${pdfProgress.done}/${pdfProgress.total}`
                    : "جاري إنشاء الملف..."
                  : "تنزيل PDF"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
