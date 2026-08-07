import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Columns3,
  Command,
  Database,
  FileText,
  HeartPulse,
  LayoutDashboard,
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
import { FileDropzone } from "@/components/FileDropzone";
import { BasiraLogo } from "@/components/BasiraLogo";
import { DataTable } from "@/components/DataTable";
import { StarField } from "@/components/StarField";
import { LogoIntro } from "@/components/LogoIntro";
import { SpotlightTour } from "@/components/SpotlightTour";
import { ProcessingSteps, type Stage } from "@/components/ProcessingSteps";
import { TableSkeleton } from "@/components/TableSkeleton";
import { StatsSkeleton } from "@/components/StatsSkeleton";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { CleaningPanel } from "@/components/CleaningPanel";
import { AgentPanel } from "@/components/AgentPanel";
import type { AgentOutcome } from "@/lib/agent";
import { DashboardPanel } from "@/components/DashboardPanel";
import { WhatIfPanel } from "@/components/WhatIfPanel";
import { ChartStudioModal } from "@/components/ChartStudioModal";
import { AskData } from "@/components/AskData";
import { ReportExportButton } from "@/components/ReportExportButton";
import { HealthSkeleton } from "@/components/HealthSkeleton";
import { TypeBadge } from "@/components/TypeBadge";
import { WorkspaceSidebar, type NavSection } from "@/components/WorkspaceSidebar";
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
import { CleanTrophy } from "@/components/CleanTrophy";
import { SoundToggle } from "@/components/SoundToggle";
import { playSfx } from "@/lib/sfx";
import { buildVoiceSummary } from "@/lib/voice-summary";
import { toast } from "sonner";
import { duckdb, type TableInfo } from "@/lib/duckdb-service";
import { computeHealthReport, type HealthReport } from "@/lib/data-health";
import { applySteps, type CleanStep } from "@/lib/cleaning";
import type { PinnedInsight } from "@/lib/report";
import { SessionMenu, SessionRestoreDialog } from "@/components/SessionMenu";
import {
  clearSession,
  downloadProject,
  loadSession,
  readProjectFile,
  saveSession,
  type WorkspaceSession,
} from "@/lib/workspace-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "بصيرة — استعراض ملفات CSV و XLSX محلياً" },
      {
        name: "description",
        content:
          "ارفع ملف CSV أو XLSX واستعرض بياناته في جدول عربي مع فرز وبحث — القراءة تتم محلياً في متصفحك.",
      },
      { property: "og:title", content: "بصيرة — استعراض ملفات CSV و XLSX محلياً" },
      {
        property: "og:description",
        content: "أداة عربية لقراءة ملفات البيانات وعرض أول 100 صف مع الفرز والبحث، دون رفع أي ملف.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
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
  const [sheet, setSheet] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [cleanSteps, setCleanSteps] = useState<CleanStep[]>([]);
  const [pinned, setPinned] = useState<PinnedInsight[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [restorable, setRestorable] = useState<WorkspaceSession | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [seal, setSeal] = useState<AuditSeal | null>(null);
  const [signals, setSignals] = useState<AnomalySignal[]>([]);
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [playbook, setPlaybook] = useState<PlaybookResult | null>(null);
  const [storyOpen, setStoryOpen] = useState(false);

  useEffect(() => {
    void duckdb.preload();
    return () => void duckdb.dispose();
  }, []);

  // البحث عن جلسة عمل سابقة عند فتح الصفحة.
  useEffect(() => {
    let alive = true;
    void loadSession().then((s) => {
      if (alive && s) setRestorable(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function registerSheet(parsed: ParsedFile, name: string) {
    const target = parsed.sheets[name];
    if (!target || target.columns.length === 0) {
      setTableInfo(null);
      return;
    }
    setCleanSteps([]);
    const info = await duckdb.loadTable(target);
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
        toast.success("تمت قراءة الملف بنجاح", {
          description: `${parsed.fileName} · ${formatBytes(parsed.fileSize)}`,
        });
      }
    } catch (e) {
      setData(null);
      setTableInfo(null);
      setHealth(null);
      const msg =
        e instanceof Error && e.message.startsWith("تعذّر")
          ? e.message
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
    (params: { search: string; sortColumn: string | null; sortDir: "asc" | "desc"; limit: number }) =>
      duckdb.fetchRows({
        columns: dbColumns,
        search: params.search,
        sortColumn: params.sortColumn,
        sortDir: params.sortDir,
        limit: params.limit,
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
    playSfx("success");
    void runHealth(info);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const [activeSection, setActiveSection] = useState("upload");
  const contentRef = useRef<HTMLDivElement>(null);

  const sections = useMemo<NavSection[]>(
    () => [
      { id: "upload", label: "رفع الملف", icon: UploadCloud, enabled: true },
      {
        id: "health",
        label: "صحة البيانات",
        icon: HeartPulse,
        enabled: !!health,
        hint: health ? `${health.score}` : undefined,
      },
      { id: "clean", label: "التنظيف", icon: Wand2, enabled: ready && !!health },
      { id: "agent", label: "الوكيل الذكي", icon: Bot, enabled: ready },
      { id: "dashboard", label: "الملخص البصري", icon: LayoutDashboard, enabled: ready },
      { id: "whatif", label: "محاكي ماذا لو؟", icon: SlidersHorizontal, enabled: ready },
      {
        id: "table",
        label: "الجدول",
        icon: Table2,
        enabled: ready,
        hint: ready ? `${tableInfo!.schema.length}` : undefined,
      },
      {
        id: "insights",
        label: "الاستنتاجات",
        icon: Sparkles,
        enabled: ready,
        hint: pinned.length ? `${pinned.length}` : undefined,
      },
    ],
    [health, ready, hasCleanableIssues, tableInfo, pinned.length],
  );

  /** تتبّع القسم الظاهر لتحديث حالة الشريط الجانبي. */
  useEffect(() => {
    const root = contentRef.current;
    if (!root) return;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-section]"));
    if (nodes.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.getAttribute("data-section") ?? "upload");
      },
      { rootMargin: "-96px 0px -55% 0px", threshold: [0.1, 0.5] },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, [ready, health, hasCleanableIssues]);

  function navigate(id: string) {
    if (id === "insights") {
      setAskOpen(true);
      setActiveSection("insights");
      return;
    }
    const el = contentRef.current?.querySelector(`[data-section="${id}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
    setSavedAt(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("تم مسح مساحة العمل", { description: "يمكنك رفع ملف جديد الآن." });
  }

  /** استعادة جلسة كاملة: إعادة تحميل الورقة في DuckDB ثم إعادة تطبيق خطوات التنظيف. */
  async function restoreSession(session: WorkspaceSession, label = "تمت استعادة الجلسة") {
    setRestoring(true);
    setError(null);
    setLoading(true);
    setStage("preparing");
    try {
      const target = session.file.sheets[session.sheet];
      if (!target || target.columns.length === 0) throw new Error("empty");
      setData(session.file);
      setSheet(session.sheet);
      let info = await duckdb.loadTable(target);
      if (session.cleanSteps.length > 0) info = await applySteps(session.cleanSteps);
      setCleanSteps(session.cleanSteps);
      setPinned(session.pinned);
      setTableInfo(info);
      void runHealth(info);
      setRestorable(null);
      setSavedAt(session.savedAt);
      toast.success(label, {
        description: `${session.file.fileName} · ${session.cleanSteps.length} خطوة تنظيف · ${session.pinned.length} استنتاج`,
      });
    } catch {
      setError("تعذّرت استعادة الجلسة السابقة. جرّب رفع الملف من جديد.");
      toast.error("تعذّرت الاستعادة");
      setRestorable(null);
    } finally {
      setRestoring(false);
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
      const msg = e instanceof Error ? e.message : "تعذّر فتح ملف المشروع.";
      setError(msg);
      toast.error("تعذّر فتح المشروع", { description: msg });
    }
  }

  /** حفظ تلقائي للجلسة داخل IndexedDB بعد كل تغيير جوهري. */
  useEffect(() => {
    if (!data || !sheet || !tableInfo) return;
    setSaving(true);
    const id = setTimeout(() => {
      void saveSession({ file: data, sheet, cleanSteps, pinned }).then((ok) => {
        setSaving(false);
        if (ok) setSavedAt(Date.now());
      });
    }, 900);
    return () => clearTimeout(id);
  }, [data, sheet, tableInfo, cleanSteps, pinned]);

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full bg-background">
        <StarField />
        <LogoIntro />
        <SpotlightTour />
        <CleanTrophy score={health?.score ?? null} steps={cleanSteps.length} />

        <DataStory
          open={storyOpen}
          onOpenChange={setStoryOpen}
          slides={storySlides}
          fileName={data?.fileName ?? "بصيرة"}
          seal={seal}
          voiceText={voiceText}
        />

        <SessionRestoreDialog
          session={data ? null : restorable}
          busy={restoring}
          onRestore={() => restorable && void restoreSession(restorable)}
          onDismiss={() => {
            setRestorable(null);
            void clearSession();
          }}
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
          <header className="sticky top-0 z-20 border-b border-white/10 bg-background/70 backdrop-blur-xl">
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
                <span className="font-mono text-[11px]" dir="ltr">⌘K</span>
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
              <SoundToggle />
              <SessionMenu
                hasData={!!data && !!tableInfo}
                savedAt={savedAt}
                saving={saving}
                onSaveProject={() => {
                  if (!data) return;
                  downloadProject({ file: data, sheet, cleanSteps, pinned });
                  toast.success("تم حفظ ملف المشروع", { description: "يمكنك فتحه لاحقاً لاستكمال التحليل." });
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

          <div ref={contentRef} className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">
            {!data && !loading && (
              <section className="aura rise-in pt-6 pb-2 text-center">
                <span className="glass-pill mx-auto text-muted-foreground">
                  <Sparkles className="size-3.5 text-accent" strokeWidth={2} />
                  تحليل بيانات بالذكاء الاصطناعي — داخل متصفحك بالكامل
                </span>
                <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold leading-[1.25] tracking-tight sm:text-5xl">
                  حوّل ملفاتك إلى <span className="text-gradient">بصيرة</span> واضحة
                </h1>
                <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                  ارفع ملف <span dir="ltr" className="font-mono text-foreground/90">CSV</span> أو{" "}
                  <span dir="ltr" className="font-mono text-foreground/90">XLSX</span>، واسأل بياناتك
                  بالعربية، واحصل على تقرير تنفيذي جاهز — بلا خوادم ولا حسابات.
                </p>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    size="lg"
                    onClick={() =>
                      document
                        .getElementById("basira-dropzone")
                        ?.scrollIntoView({ behavior: "smooth", block: "center" })
                    }
                    className="glow-cta h-12 rounded-xl px-7 text-sm font-bold"
                  >
                    ابدأ التحليل الآن
                    <ArrowLeft className="size-4" strokeWidth={2.25} />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => setPaletteOpen(true)}
                    className="glass glass-hover h-12 rounded-xl border-white/10 px-6 text-sm font-semibold"
                  >
                    <Command className="size-4" strokeWidth={2} />
                    استكشف الأوامر
                  </Button>
                </div>
                <p className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="size-3.5 text-primary" strokeWidth={2} />
                  خصوصية كاملة: لا تغادر بياناتك جهازك أبداً
                </p>
              </section>
            )}

            <section data-section="upload" className="scroll-mt-24 space-y-4">
              <FileDropzone onFile={handleFile} loading={loading} compact={!!data} />
              <ProcessingSteps stage={stage} />
            </section>

            {error && (
              <div
                role="alert"
                className="rise-in flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive"
              >
                <AlertCircle className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
                <p className="flex-1 text-sm font-medium">{error}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-destructive"
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

            {!data && !loading && !error && (
              <div className="rise-in grid gap-4 sm:grid-cols-3">
                {[
                  {
                    icon: <Table2 className="size-5" strokeWidth={2} />,
                    t: "معاينة فورية",
                    d: "جدول قابل للفرز والبحث فوق محرك تحليلي سريع.",
                  },
                  {
                    icon: <HeartPulse className="size-5" strokeWidth={2} />,
                    t: "صحة البيانات",
                    d: "درجة جودة من 100 مع كشف النواقص والتكرار.",
                  },
                  {
                    icon: <FileText className="size-5" strokeWidth={2} />,
                    t: "تقرير تنفيذي",
                    d: "تصدير PDF عربي بمؤشرات وتوصيات جاهزة.",
                  },
                ].map((f) => (
                  <div
                    key={f.t}
                    className="glass glass-hover rounded-2xl p-5 text-right hover:-translate-y-0.5"
                  >
                    <div className="flex size-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                      {f.icon}
                    </div>
                    <h3 className="mt-4 font-display text-sm font-bold">{f.t}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{f.d}</p>
                  </div>
                ))}
              </div>
            )}

            {data && active && !loading && (
              <div className="rise-in space-y-8">
                <section data-section="health" className="scroll-mt-24 space-y-4">
                  <SectionHeading
                    icon={<HeartPulse className="size-4" strokeWidth={2} />}
                    title="نظرة عامة"
                    subtitle="ملخص الملف وجودة البيانات"
                  />

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                      icon={<FileText className="size-5" strokeWidth={2} />}
                      label="اسم الملف"
                      value={data.fileName}
                    />
                    <StatCard
                      icon={<Weight className="size-5" strokeWidth={2} />}
                      label="حجم الملف"
                      value={formatBytes(data.fileSize)}
                    />
                    <StatCard
                      icon={<Rows3 className="size-5" strokeWidth={2} />}
                      label="عدد الصفوف"
                      value={(tableInfo?.rowCount ?? active.rows.length).toLocaleString("en-US")}
                    />
                    <StatCard
                      icon={<Columns3 className="size-5" strokeWidth={2} />}
                      label="عدد الأعمدة"
                      value={(tableInfo?.schema.length ?? active.columns.length).toLocaleString("en-US")}
                    />
                  </div>

                  <PlaybookPanel
                    tableInfo={tableInfo}
                    sourceKey={`${sourceKey}:${cleanSteps.length}`}
                    onResult={setPlaybook}
                  />

                  {healthLoading && <HealthSkeleton />}
                  {!healthLoading && health && <HealthScoreCard report={health} />}

                  <AnomalyRadar
                    tableInfo={tableInfo}
                    sourceKey={sourceKey}
                    onSignals={setSignals}
                  />

                  <div className="flex flex-wrap items-center gap-3">
                    {seal && <AuditSealBadge seal={seal} className="min-w-[280px] flex-1" />}
                    <div className="flex gap-2">
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
                        className="clay-press rounded-xl border-primary/25 bg-primary/[0.06] text-primary"
                      >
                        <Clapperboard className="size-4" strokeWidth={2.25} />
                        عرض قصة البيانات
                      </Button>
                    </div>
                  </div>
                </section>

                {!healthLoading && health && tableInfo && (
                  <section data-section="clean" className="scroll-mt-24 space-y-4">
                    <SectionHeading
                      icon={<Wand2 className="size-4" strokeWidth={2} />}
                      title="التنظيف الموجّه"
                      subtitle="عمليات غير تدميرية تُطبَّق كطبقة فوق بياناتك"
                    />
                    <CleaningPanel
                      tableInfo={tableInfo}
                      health={health}
                      steps={cleanSteps}
                      onStepsChange={setCleanSteps}
                      onApplied={handleCleaned}
                    />
                  </section>
                )}

                <section data-section="dashboard" className="scroll-mt-24 space-y-4">
                  {null}
                </section>

                <section data-section="dashboard-real" className="hidden" />
                  <SectionHeading
                    icon={<LayoutDashboard className="size-4" strokeWidth={2} />}
                    title="الملخص البصري"
                    subtitle="رسوم تلقائية لأهم الأعمدة — محسوبة محلياً عبر SQL"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setStudioOpen(true)}
                    className="clay-press gap-1.5 rounded-xl text-xs"
                  >
                    <Pencil className="size-3.5" strokeWidth={2} />
                    استوديو تخصيص الرسوم
                  </Button>
                  <ChartStudioModal
                    open={studioOpen}
                    onOpenChange={setStudioOpen}
                    tableInfo={tableInfo}
                    seedTitle="رسم مخصص"
                  />
                  <DashboardPanel
                    tableInfo={tableInfo}
                    sourceKey={`${data.fileName}:${sheet}:${cleanSteps.length}`}
                  />
                </section>

                <section data-section="whatif" className="scroll-mt-24 space-y-4">
                  <SectionHeading
                    icon={<SlidersHorizontal className="size-4" strokeWidth={2} />}
                    title="محاكي ماذا لو؟"
                    subtitle="حرّك النسبة لترى أثرها على المؤشرات والرسوم فوراً — حساب محلي بالكامل"
                  />
                  <WhatIfPanel
                    tableInfo={tableInfo}
                    sourceKey={`${data.fileName}:${sheet}:${cleanSteps.length}`}
                  />
                </section>

                <section data-section="table" className="scroll-mt-24 space-y-4">
                  <SectionHeading
                    icon={<Table2 className="size-4" strokeWidth={2} />}
                    title="البيانات"
                    subtitle="أول 100 صف مع فرز وبحث عبر DuckDB"
                  />

                  {tableInfo && (
                    <div className="clay space-y-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
                          <Database className="size-4" strokeWidth={2} />
                        </span>
                        <span className="text-sm font-medium">أنواع الأعمدة المستنتجة</span>
                        <span className="font-mono text-xs text-muted-foreground">DuckDB</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {tableInfo.schema.map((c) => (
                          <TypeBadge key={c.name} name={c.name} type={c.type} />
                        ))}
                      </div>
                    </div>
                  )}

                  {data.sheetNames.length > 1 && (
                    <div className="flex items-center gap-3">
                      <label className="text-sm font-medium">ورقة العمل:</label>
                      <Select value={sheet} onValueChange={(v) => void handleSheetChange(v)}>
                        <SelectTrigger className="w-64 bg-card">
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
                    </div>
                  )}

                  {tableInfo && tableInfo.schema.length > 0 ? (
                    <DataTable
                      columns={dbColumns}
                      fetchRows={fetchRows}
                      countRows={countRows}
                      sourceKey={`${data.fileName}:${sheet}:${cleanSteps.length}`}
                    />
                  ) : active.columns.length === 0 ? (
                    <div className="clay rounded-2xl border border-border bg-card px-6 py-12 text-center text-muted-foreground">
                      هذه الورقة فارغة، اختر ورقة أخرى.
                    </div>
                  ) : null}
                </section>
              </div>
            )}
          </div>

          {ready && tableInfo && active && (
            <>
              <AskDataFab onClick={() => setAskOpen(true)} count={pinned.length} />
              <AskDataDrawer
                open={askOpen}
                onOpenChange={setAskOpen}
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
