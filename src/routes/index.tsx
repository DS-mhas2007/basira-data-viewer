import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Columns3, Database, FileText, Rows3, Weight, X } from "lucide-react";
import { BasiraLogo } from "@/components/BasiraLogo";
import { EmptyIllustration } from "@/components/EmptyIllustration";
import { FileDropzone } from "@/components/FileDropzone";
import { DataTable } from "@/components/DataTable";
import { StarField } from "@/components/StarField";
import { ProcessingSteps, type Stage } from "@/components/ProcessingSteps";
import { TableSkeleton } from "@/components/TableSkeleton";
import { StatsSkeleton } from "@/components/StatsSkeleton";
import { HealthScoreCard } from "@/components/HealthScoreCard";
import { CleaningPanel } from "@/components/CleaningPanel";
import { AskData } from "@/components/AskData";
import { HealthSkeleton } from "@/components/HealthSkeleton";
import { TypeBadge } from "@/components/TypeBadge";
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

  return (
    <main className="relative min-h-screen bg-background">
      <StarField />
      <header className="sticky top-0 z-20 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3.5">
            <div className="clay flex size-11 items-center justify-center rounded-2xl border border-border/70 bg-card">
              <BasiraLogo className="size-7" />
            </div>
            <div className="space-y-1">
              <h1 className="font-display text-2xl font-extrabold leading-none tracking-tight">بصيرة</h1>
              <p className="text-xs leading-none text-muted-foreground">استعراض ملفات البيانات محلياً</p>
            </div>
          </div>
          <span className="hidden rounded-lg border border-accent/25 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent sm:inline">
            لا يُرفع أي ملف إلى الإنترنت
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <FileDropzone onFile={handleFile} loading={loading} compact={!!data} />

        <ProcessingSteps stage={stage} />

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
              ابدأ برفع ملف <span dir="ltr">CSV</span> أو <span dir="ltr">XLSX</span> لعرض أول 100 صف
              في جدول قابل للفرز والبحث.
            </p>
          </div>
        )}

        {data && active && !loading && (
          <section className="rise-in space-y-6">
            {healthLoading && <HealthSkeleton />}
            {!healthLoading && health && <HealthScoreCard report={health} />}

            {!healthLoading && health && tableInfo && hasCleanableIssues && (
              <CleaningPanel
                tableInfo={tableInfo}
                health={health}
                steps={cleanSteps}
                onStepsChange={setCleanSteps}
                onApplied={handleCleaned}
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<FileText className="size-5" strokeWidth={2} />} label="اسم الملف" value={data.fileName} />
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

            {tableInfo && tableInfo.schema.length > 0 && (
              <AskData tableInfo={tableInfo} sample={active.rows.slice(0, 8)} health={health} />
            )}
          </section>
        )}
      </div>
    </main>
  );
}
