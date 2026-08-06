import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Columns3,
  Database,
  FileText,
  HeartPulse,
  Rows3,
  Sparkles,
  Table2,
  UploadCloud,
  Wand2,
  Weight,
  X,
} from "lucide-react";
import { EmptyIllustration } from "@/components/EmptyIllustration";
import { FileDropzone } from "@/components/FileDropzone";
import { DataTable } from "@/components/DataTable";
import { StarField } from "@/components/StarField";
import { LogoIntro } from "@/components/LogoIntro";
import { ProcessingSteps, type Stage } from "@/components/ProcessingSteps";
import { TableSkeleton } from "@/components/TableSkeleton";
import { StatsSkeleton } from "@/components/StatsSkeleton";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { CleaningPanel } from "@/components/CleaningPanel";
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
import { duckdb, type TableInfo } from "@/lib/duckdb-service";
import { computeHealthReport, type HealthReport } from "@/lib/data-health";
import type { CleanStep } from "@/lib/cleaning";
import type { PinnedInsight } from "@/lib/report";

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
    <div className="clay clay-lift flex items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-xs leading-none text-muted-foreground">{label}</p>
        <p dir="auto" className="truncate font-mono text-sm font-semibold leading-none">
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

  useEffect(() => {
    void duckdb.preload();
    return () => void duckdb.dispose();
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
      }
    } catch (e) {
      setData(null);
      setTableInfo(null);
      setHealth(null);
      setError(
        e instanceof Error && e.message.startsWith("تعذّر")
          ? e.message
          : "فشلت قراءة الملف. تأكد أنه سليم وغير تالف ثم حاول مرة أخرى.",
      );
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
    void runHealth(info);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasCleanableIssues =
    !!health &&
    (health.duplicateRows > 0 || health.missingCells > 0 || health.mismatchedColumns > 0);

  const ready = !!tableInfo && tableInfo.schema.length > 0 && !loading;
  const [askOpen, setAskOpen] = useState(false);
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
      { id: "clean", label: "التنظيف", icon: Wand2, enabled: ready && hasCleanableIssues },
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

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full bg-background">
        <StarField />
        <LogoIntro />

        <WorkspaceSidebar
          sections={sections}
          activeId={activeSection}
          onNavigate={navigate}
          fileName={data?.fileName}
          rowCount={tableInfo?.rowCount ?? 0}
          columnCount={tableInfo?.schema.length ?? 0}
        />

        <SidebarInset className="relative min-w-0 bg-transparent">
          <header className="sticky top-0 z-20 border-b border-border/40 bg-background/75 backdrop-blur-xl">
            <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
              <SidebarTrigger className="size-9 rounded-xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-sm font-bold leading-tight">
                  {data?.fileName ?? "مساحة العمل"}
                </p>
                <p className="truncate text-[11px] leading-tight text-muted-foreground">
                  {ready
                    ? `${(tableInfo?.rowCount ?? 0).toLocaleString("en-US")} صف · ${tableInfo?.schema.length} عمود`
                    : "ارفع ملف CSV أو XLSX للبدء"}
                </p>
              </div>
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
              />
            </div>
          </header>

          <div ref={contentRef} className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">
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
              <div className="rise-in clay rounded-2xl border border-border/70 bg-card px-6 py-16 text-center">
                <EmptyIllustration className="mx-auto w-full max-w-[280px] text-foreground" />
                <h2 className="mt-6 font-display text-xl font-bold">لا توجد بيانات بعد</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  ابدأ برفع ملف <span dir="ltr">CSV</span> أو <span dir="ltr">XLSX</span> لعرض أول 100
                  صف في جدول قابل للفرز والبحث.
                </p>
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

                  {healthLoading && <HealthSkeleton />}
                  {!healthLoading && health && <HealthScoreCard report={health} />}
                </section>

                {!healthLoading && health && tableInfo && hasCleanableIssues && (
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
