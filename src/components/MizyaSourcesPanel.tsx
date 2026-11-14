import { useEffect, useState } from "react";
import { Check, Database, FileSpreadsheet, HardDrive, Loader2, Trash2 } from "lucide-react";
import { formatBytes } from "@/lib/parse-file";
import type { DataSourceDescriptor } from "@/lib/mizya-project";
import { indexedDbProjectRepository } from "@/lib/mizya-project-repository";
import { duckdb } from "@/lib/duckdb-service";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  projectId: string;
  refreshKey?: number;
  activeAlias?: string | undefined;
  onActivate: (source: DataSourceDescriptor, assetName: string) => void;
  onDelete: (source: DataSourceDescriptor) => Promise<void>;
}

export function MizyaSourcesPanel({ projectId, refreshKey = 0, activeAlias, onActivate, onDelete }: Props) {
  const [sources, setSources] = useState<DataSourceDescriptor[]>([]);
  const [rowCounts, setRowCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const [manifest, registered] = await Promise.all([
        indexedDbProjectRepository.getProject(projectId),
        duckdb.listSources().catch(() => []),
      ]);
      setSources(manifest?.sources ?? []);
      setRowCounts(Object.fromEntries(registered.map((source) => [source.alias, source.info.rowCount])));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [manifest, registered] = await Promise.all([
          indexedDbProjectRepository.getProject(projectId),
          duckdb.listSources().catch(() => []),
        ]);
        if (!alive) return;
        setSources(manifest?.sources ?? []);
        setRowCounts(Object.fromEntries(registered.map((source) => [source.alias, source.info.rowCount])));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [projectId, refreshKey, activeAlias]);

  async function confirmDelete(source: DataSourceDescriptor) {
    setDeletingId(source.id);
    try {
      await onDelete(source);
      setConfirmId(null);
      await refresh();
    } catch {
      toast.error("تعذّر إكمال حذف المصدر", { description: "لم يكتمل تنظيف المصدر؛ تحقّق من حالته ثم أعد المحاولة." });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section dir="rtl" className="space-y-3 rounded-2xl border border-border/60 bg-card/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Database className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">مصادر هذا المشروع</h2>
            <p className="text-xs text-muted-foreground">اختر ورقة محفوظة لتفعيلها، أو احذف مصدراً لم تعد تحتاجه</p>
          </div>
        </div>
        <span className="rounded-full border border-border/60 px-2.5 py-1 text-xs text-muted-foreground">
          {sources.length} مصدر
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> جارٍ تحميل المصادر…
        </div>
      ) : sources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center">
          <FileSpreadsheet className="mx-auto mb-2 size-6 text-muted-foreground" />
          <p className="text-sm font-medium">لا توجد مصادر محفوظة بعد</p>
          <p className="mt-1 text-xs text-muted-foreground">ارفع ملف CSV أو Excel لإضافته إلى هذا المشروع</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => (
            <article key={source.id} className="rounded-xl border border-border/60 bg-background/70 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={source.name}>{source.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><HardDrive className="size-3" /> {source.file ? formatBytes(source.file.fileSize) : "مصدر خارجي"}</span>
                      <span>{source.assets.length} ورقة</span>
                      <span className={source.status === "ready" ? "text-emerald-500" : "text-amber-500"}>
                        {source.status === "ready" ? "محفوظ محلياً" : source.status === "needs-relink" ? "يحتاج إعادة رفع" : source.status === "error" ? "تعذّر التحميل" : "قيد الإعداد"}
                      </span>
                    </div>
                  </div>
                </div>
                {confirmId === source.id ? (
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="destructive" disabled={deletingId === source.id} onClick={() => void confirmDelete(source)}>
                      {deletingId === source.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      تأكيد الحذف
                    </Button>
                    <Button size="sm" variant="ghost" disabled={deletingId === source.id} onClick={() => setConfirmId(null)}>إلغاء</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => setConfirmId(source.id)}>
                    <Trash2 className="size-3.5" /> حذف
                  </Button>
                )}
              </div>

              {source.assets.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {source.assets.map((asset) => {
                    const alias = `${source.id}__${asset.name}`;
                    const isActive = activeAlias === alias;
                    const rowCount = rowCounts[alias];
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => onActivate(source, asset.name)}
                        disabled={source.status !== "ready"}
                        className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${isActive ? "border-primary/50 bg-primary/10 text-primary" : "border-border/60 bg-surface-1 hover:border-primary/40"}`}
                        title={rowCount === undefined ? "اضغط لتفعيل هذه الورقة في DuckDB" : `${rowCount.toLocaleString("en-US")} صف`}
                      >
                        {isActive ? <Check className="size-3.5" /> : <Database className="size-3.5" />}
                        <span>{asset.name}</span>
                        {rowCount !== undefined && <span dir="ltr" className="font-mono text-[10px] opacity-70">{rowCount.toLocaleString("en-US")}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
