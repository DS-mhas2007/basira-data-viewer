import { computeFindings, type Finding } from "@/lib/findings";
import { friendlyError } from "@/lib/friendly-error";
import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  LayoutGrid,
  BellRing,
  ArrowLeft,
  Bot,
  Columns3,
  Command,
  Database,
  FileText,
  HeartPulse,
  Home,
  LayoutTemplate,
  LayoutDashboard,
  Lightbulb,
  Pencil,
  SlidersHorizontal,
  Lock,
  Clapperboard,
  Rows3,
  Sparkles,
  Table2,
  UploadCloud,
  Wand2,
  Weight,
  X,
} from "lucide-react";
import { MizyaWorkspaceBar } from "@/components/MizyaWorkspaceBar";
import {
  createDataSource,
  createProjectManifest,
  type MizyaProject,
} from "@/lib/mizya-project";
import { indexedDbProjectRepository } from "@/lib/mizya-project-repository";
import { ensurePersonalWorkspace } from "@/lib/mizya-workspace";
import { FileDropzone } from "@/components/FileDropzone";
import { DiscoveryHome } from "@/components/discovery/DiscoveryHome";
import { BasiraLogo } from "@/components/BasiraLogo";
import { SpotlightTour } from "@/components/SpotlightTour";
import { ProcessingSteps, type Stage } from "@/components/ProcessingSteps";
import { TableSkeleton } from "@/components/TableSkeleton";
import { StatsSkeleton } from "@/components/StatsSkeleton";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import type { AgentOutcome } from "@/lib/agent";

// Serialize source-manifest appends so near-simultaneous uploads cannot overwrite
// each other's descriptors with stale IndexedDB snapshots.
let projectSourcePersistenceQueue: Promise<void> = Promise.resolve();
function enqueueProjectSourcePersistence<T>(operation: () => Promise<T>): Promise<T> {
  const result = projectSourcePersistenceQueue.then(operation, operation);
  projectSourcePersistenceQueue = result.then(() => undefined, () => undefined);
  return result;
}

// تحميل كسول (lazy) للأقسام التي تظهر فقط بعد جهوزية البيانات.
// هذا يقلّل حجم الحزمة الأولية دون أي تغيير في السلوك أو الشكل.
const DataTable = lazy(() =>
  import("@/components/DataTable").then((m) => ({ default: m.DataTable })),
);
const CleaningPanel = lazy(() =>
  import("@/components/CleaningPanel").then((m) => ({ default: m.CleaningPanel })),
);
const AgentPanel = lazy(() =>
  import("@/components/AgentPanel").then((m) => ({ default: m.AgentPanel })),
);
const TemplateGallery = lazy(() =>
  import("@/components/TemplateGallery").then((m) => ({ default: m.TemplateGallery })),
);
const DashboardPanel = lazy(() =>
  import("@/components/DashboardPanel").then((m) => ({ default: m.DashboardPanel })),
);
const WhatIfPanel = lazy(() =>
  import("@/components/WhatIfPanel").then((m) => ({ default: m.WhatIfPanel })),
);
const AlertsPanel = lazy(() =>
  import("@/components/AlertsPanel").then((m) => ({ default: m.AlertsPanel })),
);
const DashboardBuilder = lazy(() =>
  import("@/components/DashboardBuilder").then((m) => ({ default: m.DashboardBuilder })),
);
const ChartStudioModal = lazy(() =>
  import("@/components/ChartStudioModal").then((m) => ({ default: m.ChartStudioModal })),
);
import { ReportExportButton } from "@/components/ReportExportButton";
import { HealthSkeleton } from "@/components/HealthSkeleton";
import { TypeBadge } from "@/components/TypeBadge";
import { WorkspaceSidebar, type NavSection } from "@/components/WorkspaceSidebar";
import { PageHeader } from "@/components/shell/PageHeader";
import { EmptyState } from "@/components/shell/EmptyState";
import { MobileNav } from "@/components/shell/MobileNav";
import { MetricCard } from "@/components/MetricCard";
import { AskBasiraComposer } from "@/components/AskBasiraComposer";
import { buildSuggestionGroups } from "@/lib/question-suggestions";
import { AskDataDrawer, AskDataFab } from "@/components/AskDataDrawer";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBytes, parseFile, validateFile, type ParsedFile } from "@/lib/parse-file";
import { CommandPalette } from "@/components/CommandPalette";
import { AnomalyRadar } from "@/components/AnomalyRadar";
import { AuditSealBadge } from "@/components/AuditSeal";
import { VoiceSummaryButton } from "@/components/VoiceSummaryButton";
import { DataStory, buildStorySlides } from "@/components/DataStory";
import { computeAuditSeal, type AuditSeal } from "@/lib/audit-seal";
import type { AnomalySignal } from "@/lib/anomaly-radar";
import { profileDataset, type DatasetProfile } from "@/lib/profile";
import { PlaybookPanel } from "@/components/PlaybookPanel";
import type { PlaybookResult } from "@/lib/playbooks";
import { ShareSummaryButton } from "@/components/ShareSummaryButton";
import { buildVoiceSummary } from "@/lib/voice-summary";
import { toast } from "sonner";
import { duckdb, TABLE_NAME, type TableInfo } from "@/lib/duckdb-service";
import { computeHealthReport, type HealthReport } from "@/lib/data-health";
import { applySteps, type CleanStep } from "@/lib/cleaning";
import type { PinnedInsight } from "@/lib/report";
import { SessionMenu } from "@/components/SessionMenu";
import {
  clearProjectSession,
  clearSession,
  downloadProject,
  loadProjectSession,
  loadProjectSourceFile,
  readProjectFile,
  saveProjectSession,
  saveProjectSourceFile,
  saveSession,
  type WorkspaceSession,
} from "@/lib/workspace-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "بصيرة — تحليل ملفات Excel و CSV بالعربية" },
      {
        name: "description",
        content:
          "حلّل ملفات Excel و CSV بالعربية داخل متصفحك: افحص جودة البيانات، نظّف الصفوف المكررة، واستكشف النتائج بأسئلة عربية وبطاقات دليل قابلة للمراجعة.",
      },
      { property: "og:title", content: "بصيرة — تحليل ملفات Excel و CSV بالعربية" },
      {
        property: "og:description",
        content:
          "تحليل عربي لملفات Excel و CSV، مع فحص الجودة والتنظيف والأسئلة الذكية ونتائج موثّقة بالاستعلام.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://basira-data-viewer.lovable.app/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://basira-data-viewer.lovable.app/" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebApplication",
        "@id": "https://basira-data-viewer.lovable.app/#application",
        name: "بصيرة",
        alternateName: "Basira",
        url: "https://basira-data-viewer.lovable.app/",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web browser",
        inLanguage: "ar",
        isPartOf: { "@id": "https://basira-data-viewer.lovable.app/#website" },
        publisher: { "@id": "https://basira-data-viewer.lovable.app/#organization" },
        description: "تحليل ملفات Excel و CSV بالعربية داخل المتصفح مع فحص جودة البيانات والتنظيف وإجابات قابلة للمراجعة.",
        featureList: ["قراءة CSV و XLSX", "فحص جودة البيانات", "تنظيف البيانات", "أسئلة عربية وبطاقات دليل", "تصدير التقارير"],
      }),
    }],
  }),
  component: Index,
});

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="glass glass-hover flex items-center gap-3 rounded-2xl px-4 py-4 hover:-translate-y-0.5">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-xs leading-none text-muted-foreground">{label}</p>
        <p dir="auto" className="truncate font-mono text-sm font-bold leading-none">
          {value}
        </p>
      </div>
    </div>
  );
}

function Index() {
  const [data, setData] = useState<ParsedFile | null>(null);
  const [activeMizyaProject, setActiveMizyaProject] = useState<MizyaProject | null>(null);
  const [sheet, setSheet] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [findingsLoading, setFindingsLoading] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [cleanSteps, setCleanSteps] = useState<CleanStep[]>([]);
  const [pinned, setPinned] = useState<PinnedInsight[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [seal, setSeal] = useState<AuditSeal | null>(null);
  const [signals, setSignals] = useState<AnomalySignal[]>([]);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [playbook, setPlaybook] = useState<PlaybookResult | null>(null);
  const [storyOpen, setStoryOpen] = useState(false);
  // الشريط الجانبي: أيقونات فقط على التابلت، مفتوح كاملاً على الديسكتوب (≥1024px).
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const sync = () => setSidebarOpen(mql.matches);
    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    void duckdb.preload();
    // ⚠️ لا تستدعِ duckdb.dispose() هنا في cleanup.
    // هذا الـ effect يعمل mount/unmount مع كل تنقّل بين الصفحات (Routes)،
    // بما فيها الانتقال إلى /chat لفتح الوكيل الذكي — فكان يمسح قاعدة
    // DuckDB بالكامل (والملف المرفوع معها) قبل ما يوصل الوكيل يقرأها.
    // الآن dispose() تُستدعى فقط صراحةً داخل resetWorkspace() عند مسح
    // مساحة العمل فعلياً.
  }, []);

  // Each project owns its own local snapshot; bootstrap migrates the old Basira session.
  async function handleMizyaProjectChange(project: MizyaProject) {
    setActiveMizyaProject(project);
    // Never leave tables from the previous project queryable in the new project context.
    setData(null);
    setSheet("");
    setTableInfo(null);
    setHealth(null);
    setCleanSteps([]);
    setPinned([]);
    setSavedAt(null);
    setLoading(true);
    setStage("preparing");
    try {
      await duckdb.clearSources();
      const manifest = await indexedDbProjectRepository.getProject(project.id);
      const restored: Array<{ file: ParsedFile; sheetName: string; alias: string }> = [];
      const restoredSourceIds = new Set<string>();

      for (const source of manifest?.sources ?? []) {
        const file = await loadProjectSourceFile(project.id, source.id);
        if (!file) continue;

        // A source is complete only when every declared asset is restored.
        let sourceComplete = source.assets.length > 0;
        for (const asset of source.assets) {
          const sheetName = file.sheetNames.includes(asset.name)
            ? asset.name
            : file.sheetNames.includes(asset.id) ? asset.id : "";
          const sheetData = sheetName ? file.sheets[sheetName] : undefined;
          if (!sheetName || !sheetData || sheetData.columns.length === 0) {
            sourceComplete = false;
            continue;
          }

          const alias = `${source.id}__${sheetName}`;
          try {
            await duckdb.registerSheet(sheetData, alias);
            restored.push({ file, sheetName, alias });
          } catch {
            // Keep restoring other assets; report this source as incomplete below.
            sourceComplete = false;
          }
        }
        if (sourceComplete) restoredSourceIds.add(source.id);
      }

      const session = await loadProjectSession(project.id);
      if (session) {
        await restoreSession(session, "تم فتح المشروع واستعادة مصادره");
      } else if (restored[0]) {
        const first = restored[0];
        const info = await duckdb.activateSource(first.alias);
        setData(first.file);
        setSheet(first.sheetName);
        setTableInfo(info);
        void runHealth(info);
        toast.success("تم فتح المشروع", {
          description: `${restored.length} ورقة بيانات متاحة في DuckDB`,
        });
      }

      const missingSourceCount = (manifest?.sources ?? []).filter(
        (source) => !restoredSourceIds.has(source.id),
      ).length;
      if (missingSourceCount > 0) {
        toast.warning("استعادة جزئية لمصادر المشروع", {
          description: `${missingSourceCount} من المصادر لم تُستعد محلياً. أعد رفع الملفات الناقصة لمتابعة التحليل الكامل.`,
        });
      }
    } catch (error) {
      setError("تعذّرت استعادة مصادر هذا المشروع. حاول إعادة تحميل الملفات.");
      toast.error("تعذّرت استعادة المشروع");
    } finally {
      setLoading(false);
      setStage("idle");
    }
  }

  async function registerSheet(parsed: ParsedFile, name: string) {
    const target = parsed.sheets[name];
    if (!target || target.columns.length === 0) {
      setTableInfo(null);
      return;
    }
    setCleanSteps([]);
    // ✅ تمرير alias (اسم الورقة) يجعل loadTable يسلك مسار التسجيل الآمن
    // في duckdb-service.ts (الذي يستدعي registerSheet + setRelation)
    // بدل المسار القديم الذي يمسح كل registeredSources ويسجّلها تحت
    // alias ثابت اسمه "main" — وهذا ما كان يكسر البحث عن المصدر
    // بالـ alias الذي اختاره المستخدم عند الرفع.
    const info = await duckdb.loadTable(target, TABLE_NAME, name);
    setTableInfo(info);
    void runHealth(info);
  }

  /** فحص صحة البيانات عبر SQL على DuckDB (يعمل بعد ظهور الجدول). */
  async function runHealth(info: TableInfo) {
    setHealth(null);
    setHealthLoading(true);
    try {
      setHealth(await computeHealthReport(info.schema, info.table));
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }

  async function handleSheetChange(name: string) {
    if (!data) return;
    setSheet(name);
    setTableInfo(null);
    setHealth(null);
    setCleanSteps([]);
    setPinned([]);
    setLoading(true);
    setError(null);
    setStage("preparing");
    try {
      await registerSheet(data, name);
    } catch {
      setError("تعذّر تحميل ورقة العمل داخل محرك DuckDB.");
    } finally {
      setLoading(false);
      setStage("idle");
    }
  }

  async function persistSourceInActiveProject(parsed: ParsedFile) {
    try {
      // Capture the destination at upload time; a later project switch must not
      // redirect an in-flight upload into another project.
      const project = activeMizyaProject ?? (await ensurePersonalWorkspace())[0] ?? null;
      if (!project) return;

      await enqueueProjectSourcePersistence(async () => {
        // Read the latest manifest only after earlier queued writes have committed.
        const current = await indexedDbProjectRepository.getProject(project.id);
        if (!current) return;

        const source = createDataSource(project.id, {
          kind: parsed.fileName.toLowerCase().endsWith(".csv") ? "csv" : "xlsx",
          name: parsed.fileName,
          file: { fileName: parsed.fileName, fileSize: parsed.fileSize },
          assets: parsed.sheetNames.map((sheetName) => ({
            id: sheetName,
            name: sheetName,
            assetType: "sheet" as const,
            columns: parsed.sheets[sheetName]?.columns ?? [],
          })),
        });
        const sourceFileSaved = await saveProjectSourceFile(project.id, source.id, parsed);
        source.status = sourceFileSaved ? "ready" : "needs-relink";
        const updatedProject = { ...current.project, updatedAt: Date.now() };
        const manifest = createProjectManifest(updatedProject, [...current.sources, source]);
        await indexedDbProjectRepository.saveProject(manifest);
        setActiveMizyaProject((active) => active?.id === project.id ? manifest.project : active);
        if (!sourceFileSaved) {
          toast.warning("سُجّل مصدر البيانات، لكن تعذّر حفظ نسخته المحلية");
        }
      });
    } catch {
      toast.error("تم تحميل الملف، لكن تعذّر حفظ مصدره في سجل المشروع");
    }
  }

  async function handleFile(file: File) {
    setError(null);
    const invalid = validateFile(file);
    if (invalid) {
      setError(invalid);
      toast.error("ملف غير مدعوم", { description: invalid });
      return;
    }
    setLoading(true);
    setStage("reading");
    setTableInfo(null);
    setHealth(null);
    setCleanSteps([]);
    setPinned([]);
    try {
      const parsed = await parseFile(file);
      setStage("analyzing");
      const first = parsed.sheetNames[0] ?? "";
      setData(parsed);
      setSheet(first);
      if (!parsed.sheets[first] || parsed.sheets[first]!.columns.length === 0) {
        setError("تمت قراءة الملف لكنه لا يحتوي على بيانات قابلة للعرض.");
      } else {
        setStage("preparing");
        await registerSheet(parsed, first);
        await persistSourceInActiveProject(parsed);
        toast.success("تمت قراءة الملف بنجاح", {
          description: `${parsed.fileName} · ${formatBytes(parsed.fileSize)}`,
        });
      }
    } catch (e) {
      setData(null);
      setTableInfo(null);
      setHealth(null);
      const raw = e instanceof Error ? e.message : "";
      const msg = raw
        ? raw.startsWith("تعذّر")
          ? raw
          : `فشلت قراءة الملف: ${raw}`
        : "فشلت قراءة الملف. تأكد أنه سليم وغير تالف ثم حاول مرة أخرى.";
      setError(msg);
      toast.error("تعذّرت قراءة الملف", { description: msg });
    } finally {
      setLoading(false);
      setStage("idle");
    }
  }

  const active = data && sheet ? data.sheets[sheet] : undefined;
  const dbColumns = tableInfo?.schema.map((c) => c.name) ?? [];

  const fetchRows = useCallback(
    (params: {
      offset: number;
      search?: string | undefined;
      sortCol?: string | undefined;
      sortDir?: "asc" | "desc";
      limit: number;
    }) =>
      duckdb.fetchRows({
        columns: dbColumns,
        search: params.search ?? "",
        sortColumn: params.sortCol ?? null,
        sortDir: params.sortDir ?? "asc",
        limit: params.limit,
        offset: params.offset,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tableInfo],
  );

  const countRows = useCallback(
    (search: string) => duckdb.countRows(dbColumns, search),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tableInfo],
  );

  /** بعد أي عملية تنظيف: حدّث الجدول وأعد حساب صحة البيانات. */
  const handleCleaned = useCallback((info: TableInfo) => {
    setTableInfo(info);
    void runHealth(info);
  }, []);

  /** يزامن نتائج الوكيل مع بقية أقسام مساحة العمل. */
  const handleAgentOutcome = useCallback((o: AgentOutcome) => {
    setTableInfo(o.tableInfo);
    setCleanSteps(o.cleanSteps);
    setHealth(o.health);
    setSignals(o.signals);
    if (o.playbook) setPlaybook(o.playbook);
    if (o.insights.length > 0) setPinned((prev) => [...prev, ...o.insights]);
  }, []);

  const hasCleanableIssues =
    !!health &&
    (health.duplicateRows > 0 || health.missingCells > 0 || health.mismatchedColumns > 0);

  const ready = !!tableInfo && tableInfo.schema.length > 0 && !loading;
  const sourceKey = data ? `${data.fileName}:${sheet}:${cleanSteps.length}` : "";

  // ختم المصداقية: بصمة SHA-256 للبيانات النشطة
  useEffect(() => {
    if (!data || !active) {
      setSeal(null);
      return;
    }
    let alive = true;
    void computeAuditSeal({
      fileName: data.fileName,
      columns: active.columns,
      rows: active.rows,
      rowCount: tableInfo?.rowCount ?? active.rows.length,
    }).then((s) => alive && setSeal(s));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, tableInfo?.rowCount]);

  // اكتشافات عربية محسوبة محلياً (بلا ذكاء اصطناعي)
  useEffect(() => {
    if (!tableInfo) {
      setFindings([]);
      return;
    }
    let alive = true;
    setFindingsLoading(true);
    void computeFindings(tableInfo)
      .then((f) => alive && setFindings(f))
      .catch(() => alive && setFindings([]))
      .finally(() => alive && setFindingsLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableInfo?.table, sourceKey]);

  // توصيف مختصر يغذّي قصة البيانات والموجز الصوتي
  useEffect(() => {
    if (!tableInfo) {
      setProfile(null);
      return;
    }
    let alive = true;
    void profileDataset(tableInfo)
      .then((p) => alive && setProfile(p))
      .catch(() => alive && setProfile(null));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableInfo?.table, sourceKey]);

  const voiceText = useMemo(
    () =>
      buildVoiceSummary({
        fileName: data?.fileName ?? "",
        health,
        profile,
        signals,
        insights: pinned.map((p) => p.evidence.title),
      }),
    [data?.fileName, health, profile, signals, pinned],
  );

  const storySlides = useMemo(
    () =>
      buildStorySlides({
        fileName: data?.fileName ?? "",
        health,
        profile,
        signals,
        insights: pinned.map((p) => p.evidence.title),
      }),
    [data?.fileName, health, profile, signals, pinned],
  );

  const [askOpen, setAskOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [askSeed, setAskSeed] = useState<string | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);

  const sections = useMemo<NavSection[]>(
    () => [
      { id: "home", label: "الرئيسية", icon: Home, enabled: true, group: "main" },
      {
        id: "data",
        label: "البيانات",
        icon: Database,
        enabled: true,
        group: "main",
        hint: ready ? `${tableInfo!.schema.length}` : undefined,
      },
      {
        id: "quality",
        label: "جودة البيانات",
        icon: HeartPulse,
        enabled: !!health,
        group: "main",
        hint: health ? `${health.score}` : undefined,
      },
      { id: "analysis", label: "التحليل", icon: LayoutDashboard, enabled: ready, group: "main" },
      { id: "ask", label: "اسأل بصيرة", icon: Sparkles, enabled: ready, group: "main" },
      {
        id: "insights",
        label: "الرؤى",
        icon: Lightbulb,
        enabled: ready,
        group: "main",
        hint: pinned.length ? `${pinned.length}` : undefined,
      },
      { id: "whatif", label: "ماذا لو؟", icon: SlidersHorizontal, enabled: ready, group: "main" },
      { id: "reports", label: "التقارير", icon: FileText, enabled: ready, group: "main" },
      { id: "board", label: "لوحة القيادة", icon: LayoutGrid, enabled: ready, group: "tools" },
      { id: "alerts", label: "التنبيهات", icon: BellRing, enabled: ready, group: "tools" },
      {
        id: "templates",
        label: "مكتبة القوالب",
        icon: LayoutTemplate,
        enabled: ready,
        group: "tools",
      },
    ],
    [health, ready, tableInfo, pinned.length],
  );

  /** تنقّل بين صفحات مساحة العمل (بدل التمرير الطويل). */
  function navigate(id: string) {
    if (id === "ask") {
      setAskSeed(undefined);
      setAskOpen(true);
      return;
    }
    setActiveSection(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** فتح لوحة "اسأل بصيرة" بسؤال جاهز من المُلحِّن. */
  function askBasira(question: string) {
    setAskSeed(question);
    setAskOpen(true);
  }

  /** أربعة أسئلة مقترحة مبنية على أعمدة الملف الحالي. */
  const askSuggestions = useMemo(
    () =>
      tableInfo
        ? buildSuggestionGroups(tableInfo)
            .flatMap((g) => g.questions)
            .slice(0, 4)
        : [],
    [tableInfo],
  );

  /** إعادة مساحة العمل لحالتها الأولى (رفع ملف آخر). */
  function resetWorkspace() {
    setData(null);
    setSheet("");
    setTableInfo(null);
    setHealth(null);
    setCleanSteps([]);
    setPinned([]);
    setError(null);
    setActiveSection("upload");
    void clearSession();
    // ✅ ننهي اتصال DuckDB هنا فقط، عند مسح صريح لمساحة العمل من قِبل
    // المستخدم — وليس عند كل خروج من الصفحة كما كان سابقاً.
    void duckdb.dispose();
    setSavedAt(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("تم مسح مساحة العمل", { description: "يمكنك رفع ملف جديد الآن." });
  }

  /** استعادة جلسة كاملة: إعادة تحميل الورقة في DuckDB ثم إعادة تطبيق خطوات التنظيف. */
  async function restoreSession(session: WorkspaceSession, label = "تمت استعادة الجلسة") {
    setError(null);
    setLoading(true);
    setStage("preparing");
    try {
      const target = session.file.sheets[session.sheet];
      if (!target || target.columns.length === 0) throw new Error("empty");
      setData(session.file);
      setSheet(session.sheet);
      // ✅ نفس تصحيح registerSheet: تمرير alias يمنع مسح registeredSources.
      let info = await duckdb.loadTable(target, TABLE_NAME, session.sheet);
      if (session.cleanSteps.length > 0) info = await applySteps(session.cleanSteps);
      setCleanSteps(session.cleanSteps);
      setPinned(session.pinned);
      setTableInfo(info);
      void runHealth(info);
      setSavedAt(session.savedAt);
      toast.success(label, {
        description: `${session.file.fileName} · ${session.cleanSteps.length} خطوة تنظيف · ${session.pinned.length} استنتاج`,
      });
    } catch {
      setError("تعذّرت استعادة الجلسة السابقة. جرّب رفع الملف من جديد.");
      toast.error("تعذّرت الاستعادة");
    } finally {
      setLoading(false);
      setStage("idle");
    }
  }

  /** فتح ملف مشروع .basira من القرص. */
  async function openProjectFile(file: File) {
    try {
      const session = await readProjectFile(file);
      await restoreSession(session, "تم فتح المشروع");
    } catch (e) {
      const msg = friendlyError(e, "تعذّر فتح ملف المشروع.");
      setError(msg);
      toast.error("تعذّر فتح المشروع", { description: msg });
    }
  }

  /** حفظ تلقائي للجلسة داخل IndexedDB بعد كل تغيير جوهري. */
  useEffect(() => {
    if (!data || !sheet || !tableInfo) return;
    setSaving(true);
    const id = setTimeout(() => {
      const snapshot = { file: data, sheet, cleanSteps, pinned };
      void Promise.all([
        saveSession(snapshot),
        activeMizyaProject
          ? saveProjectSession(activeMizyaProject.id, snapshot)
          : Promise.resolve(false),
      ]).then(([legacySaved, projectSaved]) => {
        setSaving(false);
        if (legacySaved || projectSaved) setSavedAt(Date.now());
      });
    }, 900);
    return () => clearTimeout(id);
  }, [data, sheet, tableInfo, cleanSteps, pinned, activeMizyaProject]);

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={setSidebarOpen}
      style={
        {
          "--sidebar-width": "16.25rem",
          "--sidebar-width-icon": "4.5rem",
        } as React.CSSProperties
      }
    >
      <div className="basira-app-shell relative flex min-h-screen w-full bg-background [@supports(height:100dvh)]:min-h-[100dvh]">
        <SpotlightTour />

        <DataStory
          open={storyOpen}
          onOpenChange={setStoryOpen}
          slides={storySlides}
          fileName={data?.fileName ?? "بصيرة"}
          seal={seal}
          voiceText={voiceText}
        />

        <CommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          sections={sections}
          onNavigate={navigate}
          onAsk={() => setAskOpen(true)}
          onScrollTop={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          onReset={resetWorkspace}
          canReset={!!data}
        />

        <WorkspaceSidebar
          sections={sections}
          activeId={activeSection}
          onNavigate={navigate}
          fileName={data?.fileName}
          rowCount={tableInfo?.rowCount ?? 0}
          columnCount={tableInfo?.schema.length ?? 0}
        />

        <SidebarInset className="relative min-w-0 bg-transparent">
          <div className="w-full min-w-0 px-3 pt-3">
            <MizyaWorkspaceBar onProjectChange={(project) => void handleMizyaProjectChange(project)} />
          </div>
          <header className="basira-topbar sticky top-0 z-20 border-b border-white/10 bg-background/70 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
              <SidebarTrigger className="size-9 rounded-xl" />
              <BasiraLogo className="hidden h-8 w-auto shrink-0 sm:block" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-bold leading-tight">
                  {data?.fileName ?? "بصيرة"}
                </p>
                <p className="truncate text-[11px] leading-tight text-muted-foreground">
                  {ready
                    ? `${(tableInfo?.rowCount ?? 0).toLocaleString("en-US")} صف · ${tableInfo?.schema.length} عمود`
                    : "ارفع ملف CSV أو XLSX للبدء"}
                </p>
              </div>
              {/* مؤشر حالة محرك DuckDB */}
              <span
                className="glass-pill hidden font-medium text-muted-foreground md:inline-flex"
                title="حالة محرك التحليل"
              >
                <span
                  className={
                    ready
                      ? "size-1.5 rounded-full bg-primary pulse-dot"
                      : "size-1.5 rounded-full bg-accent pulse-dot"
                  }
                />
                <span dir="ltr" className="font-mono text-[11px]">
                  DuckDB
                </span>
                <span className="text-[11px]">{ready ? "جاهز" : "بانتظار ملف"}</span>
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaletteOpen(true)}
                className="clay-press hidden rounded-xl border-white/10 bg-white/[0.03] text-muted-foreground sm:flex"
                aria-label="لوحة الأوامر"
              >
                <Command className="size-4" strokeWidth={2} />
                <span className="font-mono text-[11px]" dir="ltr">
                  ⌘K
                </span>
              </Button>
              {ready && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStoryOpen(true)}
                  className="clay-press hidden rounded-xl border-primary/25 bg-primary/[0.06] text-primary sm:flex"
                >
                  <Clapperboard className="size-4" strokeWidth={2.25} />
                  <span className="hidden text-xs font-semibold lg:inline">قصة البيانات</span>
                </Button>
              )}
              <SessionMenu
                hasData={!!data && !!tableInfo}
                savedAt={savedAt}
                saving={saving}
                onSaveProject={() => {
                  if (!data) return;
                  downloadProject({ file: data, sheet, cleanSteps, pinned });
                  toast.success("تم حفظ ملف المشروع", {
                    description: "يمكنك فتحه لاحقاً لاستكمال التحليل.",
                  });
                }}
                onOpenProject={(f) => void openProjectFile(f)}
                onClearSession={() => {
                  void clearSession();
                  setSavedAt(null);
                  toast("تم مسح الجلسة المحفوظة");
                }}
              />
              <ReportExportButton
                ready={ready && !healthLoading}
                fileName={data?.fileName ?? "بيانات"}
                health={health}
                rowCount={tableInfo?.rowCount ?? 0}
                columnCount={tableInfo?.schema.length ?? 0}
                cleanSteps={cleanSteps}
                insights={pinned}
                tableInfo={tableInfo}
                sample={active?.rows.slice(0, 8) ?? []}
                seal={seal}
                htmlContext={{ signals, playbook, seal }}
              />
            </div>
          </header>

          <div
            ref={contentRef}
            className="basira-workspace-content mx-auto w-full max-w-[1360px] space-y-7 px-4 pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 md:pb-12 lg:px-8"
          >
            {error && (
              <div
                role="alert"
                className="rise-in flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive"
              >
                <AlertCircle className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-semibold">تعذّر تنفيذ هذه العملية.</p>
                  <details>
                    <summary className="cursor-pointer text-xs opacity-80">
                      عرض التفاصيل التقنية
                    </summary>
                    <p className="mt-1 text-xs leading-relaxed opacity-90">{error}</p>
                  </details>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="إغلاق التنبيه"
                  className="size-6 shrink-0 text-destructive"
                  onClick={() => setError(null)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            )}

            {loading && (
              <section className="space-y-6">
                <StatsSkeleton />
                <HealthSkeleton />
                <TableSkeleton />
              </section>
            )}

            {!data && !loading && (
              <DiscoveryHome
                onFile={handleFile}
                loading={loading}
                stage={stage}
                hasData={false}
                health={null}
                insights={[]}
                onNavigate={navigate}
                onAsk={() => navigate("ask")}
              />
            )}

            {/* ───────── مساحة العمل بعد تحميل البيانات ───────── */}
            {data && active && !loading && (
              <div key={activeSection} className="rise-in space-y-7">
                {activeSection === "home" && (
                  <DiscoveryHome
                    onFile={handleFile}
                    loading={loading}
                    stage={stage}
                    hasData={!!data}
                    fileName={data.fileName}
                    rowCount={tableInfo?.rowCount ?? active.rows.length}
                    columnCount={tableInfo?.schema.length ?? active.columns.length}
                    health={health}
                    healthLoading={healthLoading}
                    insights={pinned}
                    findings={findings}
                    findingsLoading={findingsLoading}
                    onNavigate={navigate}
                    onAsk={() => navigate("ask")}
                  />
                )}

                {activeSection === "data" && (
                  <>
                    <PageHeader
                      icon={<Database className="size-5" strokeWidth={2} />}
                      title="البيانات"
                      subtitle={`${data.fileName} · ${formatBytes(data.fileSize)} · ${(tableInfo?.rowCount ?? active.rows.length).toLocaleString("en-US")} صف`}
                      actions={
                        data.sheetNames.length > 1 ? (
                          <Select value={sheet} onValueChange={(v) => void handleSheetChange(v)}>
                            <SelectTrigger className="w-52 rounded-xl bg-surface-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {data.sheetNames.map((name) => (
                                <SelectItem key={name} value={name}>
                                  {name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : undefined
                      }
                    />

                    <FileDropzone onFile={handleFile} loading={loading} compact />

                    {data.meta && (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-border/50 bg-surface-1 px-3 py-1 text-[11px] text-muted-foreground">
                          الترميز المكتشف:{" "}
                          <span dir="ltr" className="font-mono text-foreground">
                            {data.meta.encoding}
                          </span>
                        </span>
                        {data.meta.delimiter && (
                          <span className="rounded-full border border-border/50 bg-surface-1 px-3 py-1 text-[11px] text-muted-foreground">
                            الفاصل:{" "}
                            <span dir="ltr" className="font-mono text-foreground">
                              {data.meta.delimiter === "\t" ? "TAB" : data.meta.delimiter}
                            </span>
                          </span>
                        )}
                        {!!data.meta.skippedTitleRows && (
                          <span className="rounded-full border border-border/50 bg-surface-1 px-3 py-1 text-[11px] text-muted-foreground">
                            تم تخطّي {data.meta.skippedTitleRows} صف عنواني
                          </span>
                        )}
                        {data.meta.warnings.map((w) => (
                          <span
                            key={w}
                            className="rounded-full border border-warning/40 bg-warning/10 px-3 py-1 text-[11px] text-warning"
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    )}

                    {tableInfo && (
                      <div className="space-y-3 rounded-xl border border-border/50 bg-surface-1 px-4 py-4">
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-accent/10 text-accent">
                            <Database className="size-4" strokeWidth={2} />
                          </span>
                          <span className="text-sm font-medium">أنواع الأعمدة المستنتجة</span>
                          <span dir="ltr" className="font-mono text-[11px] text-muted-foreground">
                            DuckDB
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {tableInfo.schema.map((c) => (
                            <TypeBadge key={c.name} name={c.name} type={c.type} />
                          ))}
                        </div>
                      </div>
                    )}

                    {tableInfo && tableInfo.schema.length > 0 ? (
                      <Suspense fallback={<TableSkeleton />}>
                        <DataTable
                          columns={dbColumns}
                          fetchRows={fetchRows}
                          countRows={countRows}
                          sourceKey={`${data.fileName}:${sheet}:${cleanSteps.length}`}
                        />
                      </Suspense>
                    ) : (
                      <EmptyState
                        icon={<Table2 className="size-5" strokeWidth={2} />}
                        title="هذه الورقة فارغة"
                        description="اختر ورقة عمل أخرى من القائمة أعلاه، أو ارفع ملفاً يحتوي على بيانات."
                      />
                    )}
                  </>
                )}

                {activeSection === "quality" && (
                  <>
                    <PageHeader
                      icon={<HeartPulse className="size-5" strokeWidth={2} />}
                      title="جودة البيانات"
                      subtitle="درجة الجودة وتفاصيل المشاكل مع تنظيف غير تدميري يُطبَّق كطبقة فوق بياناتك"
                    />
                    {healthLoading && <HealthSkeleton />}
                    {!healthLoading && health && <HealthScoreCard report={health} />}
                    {!healthLoading && health && tableInfo && (
                      <Suspense fallback={<StatsSkeleton />}>
                        <CleaningPanel
                          tableInfo={tableInfo}
                          health={health}
                          steps={cleanSteps}
                          onStepsChange={setCleanSteps}
                          onApplied={handleCleaned}
                        />
                      </Suspense>
                    )}
                    {!healthLoading && !health && (
                      <EmptyState
                        icon={<HeartPulse className="size-5" strokeWidth={2} />}
                        title="لم يكتمل فحص الجودة بعد"
                        description="أعد تحميل الورقة أو ارفع الملف مجدداً لتشغيل فحص جودة البيانات."
                      />
                    )}
                  </>
                )}

                {activeSection === "analysis" && (
                  <>
                    <PageHeader
                      icon={<LayoutDashboard className="size-5" strokeWidth={2} />}
                      title="التحليل"
                      subtitle="رسوم مقترحة لأهم الأعمدة — محسوبة محلياً عبر SQL"
                      actions={
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setStudioOpen(true)}
                          className="gap-1.5 rounded-xl text-xs"
                        >
                          <Pencil className="size-3.5" strokeWidth={2} />
                          استوديو الرسوم
                        </Button>
                      }
                    />
                    {studioOpen && (
                      <Suspense fallback={null}>
                        <ChartStudioModal
                          open={studioOpen}
                          onOpenChange={setStudioOpen}
                          tableInfo={tableInfo}
                          seedTitle="رسم مخصص"
                        />
                      </Suspense>
                    )}
                    <Suspense fallback={<StatsSkeleton />}>
                      <DashboardPanel
                        tableInfo={tableInfo}
                        sourceKey={`${data.fileName}:${sheet}:${cleanSteps.length}`}
                      />
                    </Suspense>
                  </>
                )}

                {activeSection === "insights" && (
                  <>
                    <PageHeader
                      icon={<Lightbulb className="size-5" strokeWidth={2} />}
                      title="الرؤى"
                      subtitle="ما اكتشفته بصيرة في بياناتك — مرتّب حسب الأهمية ومدعوم بالأدلة"
                      actions={
                        <Button onClick={() => navigate("ask")} size="sm" className="rounded-xl">
                          <Sparkles className="size-4" strokeWidth={2.25} />
                          اسأل بصيرة
                        </Button>
                      }
                    />
                    <AnomalyRadar
                      tableInfo={tableInfo}
                      sourceKey={sourceKey}
                      onSignals={setSignals}
                    />
                    <PlaybookPanel
                      tableInfo={tableInfo}
                      sourceKey={`${sourceKey}:${cleanSteps.length}`}
                      onResult={setPlaybook}
                    />
                    {tableInfo && (
                      <Suspense fallback={<StatsSkeleton />}>
                        <AgentPanel
                          tableInfo={tableInfo}
                          fileName={data.fileName}
                          sample={active.rows.slice(0, 8)}
                          cleanSteps={cleanSteps}
                          onOutcome={handleAgentOutcome}
                        />
                      </Suspense>
                    )}
                    {pinned.length === 0 && (
                      <EmptyState
                        icon={<Lightbulb className="size-5" strokeWidth={2} />}
                        title="لم تُثبّت أي رؤية بعد."
                        description="كل نتيجة تثبّتها من «اسأل بصيرة» تظهر هنا وتُدرَج تلقائياً في التقرير."
                      />
                    )}
                  </>
                )}

                {activeSection === "whatif" && (
                  <>
                    <PageHeader
                      icon={<SlidersHorizontal className="size-5" strokeWidth={2} />}
                      title="ماذا لو؟"
                      subtitle="استكشف كيف يمكن أن تتغيّر النتائج عند تغيير بعض المتغيرات — نتائج محاكاة لا تثبت السببية"
                    />
                    <Suspense fallback={<StatsSkeleton />}>
                      <WhatIfPanel
                        tableInfo={tableInfo}
                        sourceKey={`${data.fileName}:${sheet}:${cleanSteps.length}`}
                      />
                    </Suspense>
                  </>
                )}

                {activeSection === "reports" && (
                  <>
                    <PageHeader
                      icon={<FileText className="size-5" strokeWidth={2} />}
                      title="التقارير"
                      subtitle="صدّر تحليلك كتقرير تنفيذي، أو شاركه كملخص أو قصة بيانات"
                    />
                    <div className="flex flex-wrap items-center gap-3">
                      {seal && <AuditSealBadge seal={seal} className="min-w-[280px] flex-1" />}
                      <div className="flex flex-wrap gap-2">
                        <VoiceSummaryButton text={voiceText} />
                        <ShareSummaryButton
                          input={{
                            fileName: data.fileName,
                            health,
                            rowCount: tableInfo?.rowCount ?? active.rows.length,
                            columnCount: tableInfo?.schema.length ?? active.columns.length,
                            cleanSteps,
                            insights: pinned,
                            signals,
                            playbook,
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setStoryOpen(true)}
                          className="rounded-xl border-primary/25 bg-primary/[0.06] text-primary"
                        >
                          <Clapperboard className="size-4" strokeWidth={2.25} />
                          عرض قصة البيانات
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                {activeSection === "board" && (
                  <>
                    <PageHeader
                      icon={<LayoutGrid className="size-5" strokeWidth={2} />}
                      title="لوحة القيادة"
                      subtitle="ابنِ ويدجت خاصة بك — تُحفظ محلياً وتُعاد حسابتها مع أي تغيير في البيانات"
                    />
                    <Suspense fallback={<StatsSkeleton />}>
                      <DashboardBuilder
                        tableInfo={tableInfo}
                        boardKey={`${data.fileName}:${sheet}`}
                        sourceKey={`${data.fileName}:${sheet}:${cleanSteps.length}`}
                      />
                    </Suspense>
                  </>
                )}

                {activeSection === "alerts" && (
                  <>
                    <PageHeader
                      icon={<BellRing className="size-5" strokeWidth={2} />}
                      title="التنبيهات الذكية"
                      subtitle="قواعد مراقبة تُقيَّم محلياً بعد كل تنظيف أو تغيير للورقة"
                    />
                    <Suspense fallback={<StatsSkeleton />}>
                      <AlertsPanel
                        tableInfo={tableInfo}
                        sourceKey={`${data.fileName}:${sheet}:${cleanSteps.length}`}
                      />
                    </Suspense>
                  </>
                )}

                {activeSection === "templates" && tableInfo && (
                  <>
                    <PageHeader
                      icon={<LayoutTemplate className="size-5" strokeWidth={2} />}
                      title="مكتبة القوالب"
                      subtitle="حزم تحليل جاهزة لكل قطاع — نقرة واحدة تنفّذ أسئلتها وتثبّت نتائجها"
                    />
                    <Suspense fallback={<StatsSkeleton />}>
                      <TemplateGallery
                        tableInfo={tableInfo}
                        sample={active.rows.slice(0, 8)}
                        health={health}
                        onInsights={(list) => setPinned((prev) => [...prev, ...list])}
                      />
                    </Suspense>
                  </>
                )}
              </div>
            )}
          </div>

          <MobileNav
            items={sections.map((s) => ({
              id: s.id,
              label: s.label,
              icon: s.icon,
              enabled: s.enabled,
            }))}
            primaryIds={["home", "data", "insights", "reports"]}
            activeId={activeSection}
            onNavigate={navigate}
            onAsk={() => navigate("ask")}
            askEnabled={ready}
          />
          {ready && tableInfo && active && (
            <>
              <div className="hidden md:block">
                <AskDataFab onClick={() => navigate("ask")} count={pinned.length} />
              </div>
              <AskDataDrawer
                open={askOpen}
                onOpenChange={setAskOpen}
                initialQuestion={askSeed}
                tableInfo={tableInfo}
                sample={active.rows.slice(0, 8)}
                health={health}
                pinned={pinned}
                onPinnedChange={setPinned}
              />
            </>
          )}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-base font-bold leading-tight">{title}</h2>
        <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <span className="ms-2 h-px flex-1 bg-gradient-to-l from-border/60 to-transparent" />
    </div>
  );
}
