import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Columns3, Database, Eye, FileText, Rows3, Weight, X } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { DataTable } from "@/components/DataTable";
import { StarField } from "@/components/StarField";
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
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-panel)]">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p dir="auto" className="truncate font-display font-bold">
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

  useEffect(() => () => void duckdb.dispose(), []);

  async function registerSheet(parsed: ParsedFile, name: string) {
    const target = parsed.sheets[name];
    if (!target || target.columns.length === 0) {
      setTableInfo(null);
      return;
    }
    const info = await duckdb.loadTable(target);
    setTableInfo(info);
  }

  async function handleSheetChange(name: string) {
    if (!data) return;
    setSheet(name);
    setTableInfo(null);
    setLoading(true);
    setError(null);
    try {
      await registerSheet(data, name);
    } catch {
      setError("تعذّر تحميل ورقة العمل داخل محرك DuckDB.");
    } finally {
      setLoading(false);
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
    // تنظيف الـ Worker والذاكرة قبل تحميل ملف جديد
    await duckdb.dispose();
    setTableInfo(null);
    try {
      const parsed = await parseFile(file);
      const first = parsed.sheetNames[0] ?? "";
      setData(parsed);
      setSheet(first);
      if (!parsed.sheets[first] || parsed.sheets[first]!.columns.length === 0) {
        setError("تمت قراءة الملف لكنه لا يحتوي على بيانات قابلة للعرض.");
      } else {
        await registerSheet(parsed, first);
      }
    } catch (e) {
      setData(null);
      setTableInfo(null);
      setError(
        e instanceof Error && e.message.startsWith("تعذّر")
          ? e.message
          : "فشلت قراءة الملف. تأكد أنه سليم وغير تالف ثم حاول مرة أخرى.",
      );
    } finally {
      setLoading(false);
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

  return (
    <main className="relative min-h-screen bg-background">
      <StarField />
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Eye className="size-5" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-extrabold leading-none">بصيرة</h1>
              <p className="mt-1 text-xs text-muted-foreground">استعراض ملفات البيانات محلياً</p>
            </div>
          </div>
          <span className="hidden rounded-full bg-accent/25 px-3 py-1 text-xs font-semibold text-accent-foreground sm:inline">
            لا يُرفع أي ملف إلى الإنترنت
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <FileDropzone onFile={handleFile} loading={loading} compact={!!data} />

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive"
          >
            <AlertCircle className="mt-0.5 size-5 shrink-0" />
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

        {!data && !loading && !error && (
          <div className="rounded-2xl border border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-panel)]">
            <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <FileText className="size-8" />
            </div>
            <h2 className="mt-5 font-display text-xl font-bold">لا توجد بيانات بعد</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              ابدأ برفع ملف <span dir="ltr">CSV</span> أو <span dir="ltr">XLSX</span> لعرض أول 100 صف
              في جدول قابل للفرز والبحث.
            </p>
          </div>
        )}

        {data && active && (
          <section className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard icon={<FileText className="size-4" />} label="اسم الملف" value={data.fileName} />
              <StatCard
                icon={<Weight className="size-4" />}
                label="حجم الملف"
                value={formatBytes(data.fileSize)}
              />
              <StatCard
                icon={<Rows3 className="size-4" />}
                label="عدد الصفوف"
                value={(tableInfo?.rowCount ?? active.rows.length).toLocaleString("en-US")}
              />
              <StatCard
                icon={<Columns3 className="size-4" />}
                label="عدد الأعمدة"
                value={(tableInfo?.schema.length ?? active.columns.length).toLocaleString("en-US")}
              />
            </div>

            {tableInfo && (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-accent">
                  <Database className="size-4" />
                  DuckDB
                </span>
                <span className="text-muted-foreground">أنواع الأعمدة المستنتجة:</span>
                {tableInfo.schema.map((c) => (
                  <span
                    key={c.name}
                    dir="ltr"
                    className="rounded-md border border-border bg-card px-2 py-0.5 font-mono"
                  >
                    {c.name}: <span className="text-primary">{c.type}</span>
                  </span>
                ))}
              </div>
            )}

            {data.sheetNames.length > 1 && (
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">ورقة العمل:</label>
                <Select value={sheet} onValueChange={setSheet}>
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
                sourceKey={`${data.fileName}:${sheet}`}
              />
            ) : active.columns.length === 0 ? (
              <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-muted-foreground">
                هذه الورقة فارغة، اختر ورقة أخرى.
              </div>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
