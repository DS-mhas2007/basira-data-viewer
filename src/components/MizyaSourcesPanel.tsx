import { useEffect, useState } from "react";
import { Check, Database, FileSpreadsheet, HardDrive, Loader2, Trash2 } from "@/components/icons";
import { formatBytes } from "@/lib/parse-file";
import type { DataSourceDescriptor } from "@/lib/mizya-project";
import type { JoinDiagnostics } from "@/lib/duckdb-service";
import { indexedDbProjectRepository } from "@/lib/mizya-project-repository";
import { duckdb } from "@/lib/duckdb-service";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  projectId: string;
  refreshKey?: number;
  activeAlias?: string | undefined;
  disabled?: boolean;
  /** يُخفى اللوح كاملاً عندما لا توجد مصادر (لتتصدّر الصفحة الرئيسية الرسالة والرفع). */
  hideWhenEmpty?: boolean;
  onActivate: (source: DataSourceDescriptor, assetName: string) => void;
  onDelete: (source: DataSourceDescriptor) => Promise<void>;
}

export function MizyaSourcesPanel({ projectId, refreshKey = 0, activeAlias, disabled = false, hideWhenEmpty = false, onActivate, onDelete }: Props) {
  const [sources, setSources] = useState<DataSourceDescriptor[]>([]);
  const [rowCounts, setRowCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [registeredSources, setRegisteredSources] = useState<Awaited<ReturnType<typeof duckdb.listSources>>>([]);
  const [joinLeftAlias, setJoinLeftAlias] = useState("");
  const [joinRightAlias, setJoinRightAlias] = useState("");
  const [joinLeftColumn, setJoinLeftColumn] = useState("");
  const [joinRightColumn, setJoinRightColumn] = useState("");
  const [joinType, setJoinType] = useState<"inner" | "left" | "right" | "full">("inner");
  const [joinDiagnostics, setJoinDiagnostics] = useState<JoinDiagnostics | null>(null);
  const [checkingJoin, setCheckingJoin] = useState(false);

  const selectedLeft = registeredSources.find((source) => source.alias === joinLeftAlias);
  const selectedRight = registeredSources.find((source) => source.alias === joinRightAlias);

  useEffect(() => {
    setJoinDiagnostics(null);
    if (registeredSources.length < 2) {
      setJoinDiagnostics(null);
      return;
    }
    if (!registeredSources.some((source) => source.alias === joinLeftAlias)) {
      setJoinLeftAlias(registeredSources[0]?.alias ?? "");
    }
    if (!registeredSources.some((source) => source.alias === joinRightAlias) || joinRightAlias === joinLeftAlias) {
      setJoinRightAlias(registeredSources.find((source) => source.alias !== joinLeftAlias)?.alias ?? "");
    }
  }, [registeredSources, joinLeftAlias, joinRightAlias]);

  useEffect(() => {
    if (selectedLeft && !selectedLeft.info.schema.some((column) => column.name === joinLeftColumn)) {
      setJoinLeftColumn(selectedLeft.info.schema[0]?.name ?? "");
    }
  }, [selectedLeft, joinLeftColumn]);

  useEffect(() => {
    if (selectedRight && !selectedRight.info.schema.some((column) => column.name === joinRightColumn)) {
      setJoinRightColumn(selectedRight.info.schema[0]?.name ?? "");
    }
  }, [selectedRight, joinRightColumn]);

  async function refresh() {
    setLoading(true);
    try {
      const [manifest, registered] = await Promise.all([
        indexedDbProjectRepository.getProject(projectId),
        duckdb.listSources().catch(() => []),
      ]);
      setSources(manifest?.sources ?? []);
      setRegisteredSources(registered);
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
        setRegisteredSources(registered);
        setRowCounts(Object.fromEntries(registered.map((source) => [source.alias, source.info.rowCount])));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [projectId, refreshKey, activeAlias]);

  async function checkJoinSafety() {
    if (!joinLeftAlias || !joinRightAlias || joinLeftAlias === joinRightAlias || !joinLeftColumn || !joinRightColumn) {
      toast.error("اختر مصدرين وعمودي ربط صالحين");
      return;
    }
    setCheckingJoin(true);
    setJoinDiagnostics(null);
    try {
      const diagnostics = await duckdb.diagnoseJoin({
        leftAlias: joinLeftAlias,
        rightAlias: joinRightAlias,
        leftOn: joinLeftColumn,
        rightOn: joinRightColumn,
        joinType,
      });
      setJoinDiagnostics(diagnostics);
      if (diagnostics.warning) {
        toast.warning("اكتمل الفحص مع تحذيرات؛ راجع تفاصيل العلاقة قبل اعتماد الدمج");
      } else {
        toast.success("اكتمل فحص علاقة الدمج");
      }
    } catch (error) {
      setJoinDiagnostics(null);
      toast.error("تعذّر فحص الدمج", {
        description: error instanceof Error ? error.message : "تحقق من أنواع أعمدة الربط وتوفر المصدرين.",
      });
    } finally {
      setCheckingJoin(false);
    }
  }

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

  if (hideWhenEmpty && !loading && sources.length === 0) return null;

  return (
    <section dir="rtl" className="mz-glass-card mz-glass-card--dual space-y-3 rounded-2xl border border-border/60 bg-card/50 p-4">
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
            <article key={source.id} data-mizya-source-id={source.id} className="mz-glass-card mz-glass-card--neutral rounded-xl border border-border/60 bg-background/70 p-3">
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
                    <Button size="sm" variant="destructive" disabled={disabled || deletingId === source.id} onClick={() => void confirmDelete(source)}>
                      {deletingId === source.id ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      تأكيد الحذف
                    </Button>
                    <Button size="sm" variant="ghost" disabled={disabled || deletingId === source.id} onClick={() => setConfirmId(null)}>إلغاء</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" disabled={disabled}
                    onClick={() => setConfirmId(source.id)}>
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
                        aria-pressed={isActive}
                        onClick={() => onActivate(source, asset.name)}
                        disabled={disabled || source.status !== "ready"}
                        className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${isActive ? "border-primary/50 bg-primary/10 text-primary" : "mz-glass-inset border-border/60 bg-surface-1 hover:border-primary/40"}`}
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

      {registeredSources.length >= 2 && (
        <div className="space-y-3 rounded-xl border border-border/60 bg-background/60 p-3">
          <div>
            <h3 className="text-sm font-semibold">فحص أمان الدمج</h3>
            <p className="mt-1 text-xs text-muted-foreground">افحص علاقة المفاتيح وعدد الصفوف المتوقع قبل استخدام المصدرين معاً. هذه معاينة تشخيصية ولا تغيّر بيانات المصدر أو الجدول النشط.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">المصدر الأيسر</span>
              <select className="h-9 w-full rounded-lg border border-border bg-background px-2" value={joinLeftAlias} disabled={disabled || checkingJoin} onChange={(event) => { setJoinLeftAlias(event.target.value); setJoinDiagnostics(null); }}>
                {registeredSources.map((source) => <option key={source.alias} value={source.alias}>{source.alias}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">عمود المفتاح الأيسر</span>
              <select className="h-9 w-full rounded-lg border border-border bg-background px-2" value={joinLeftColumn} disabled={disabled || checkingJoin || !selectedLeft} onChange={(event) => { setJoinLeftColumn(event.target.value); setJoinDiagnostics(null); }}>
                {(selectedLeft?.info.schema ?? []).map((column) => <option key={column.name} value={column.name}>{column.name} · {column.type}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">المصدر الأيمن</span>
              <select className="h-9 w-full rounded-lg border border-border bg-background px-2" value={joinRightAlias} disabled={disabled || checkingJoin} onChange={(event) => { setJoinRightAlias(event.target.value); setJoinDiagnostics(null); }}>
                {registeredSources.filter((source) => source.alias !== joinLeftAlias).map((source) => <option key={source.alias} value={source.alias}>{source.alias}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs">
              <span className="text-muted-foreground">عمود المفتاح الأيمن</span>
              <select className="h-9 w-full rounded-lg border border-border bg-background px-2" value={joinRightColumn} disabled={disabled || checkingJoin || !selectedRight} onChange={(event) => { setJoinRightColumn(event.target.value); setJoinDiagnostics(null); }}>
                {(selectedRight?.info.schema ?? []).map((column) => <option key={column.name} value={column.name}>{column.name} · {column.type}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-xs sm:col-span-2">
              <span className="text-muted-foreground">نوع الدمج</span>
              <select className="h-9 w-full rounded-lg border border-border bg-background px-2" value={joinType} disabled={disabled || checkingJoin} onChange={(event) => { setJoinType(event.target.value as typeof joinType); setJoinDiagnostics(null); }}>
                <option value="inner">INNER JOIN</option>
                <option value="left">LEFT JOIN</option>
                <option value="right">RIGHT JOIN</option>
                <option value="full">FULL OUTER JOIN</option>
              </select>
            </label>
          </div>
          <Button size="sm" onClick={() => void checkJoinSafety()} disabled={disabled || checkingJoin || !selectedLeft || !selectedRight || !joinLeftColumn || !joinRightColumn}>
            {checkingJoin ? <Loader2 className="size-3.5 animate-spin" /> : <Database className="size-3.5" />}
            {checkingJoin ? "جارٍ فحص العلاقة…" : "فحص أمان الدمج"}
          </Button>
          {joinDiagnostics && (
            <div className="space-y-2 rounded-lg border border-border/60 bg-card/70 p-3" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold">نتيجة التشخيص</span>
                <span className={joinDiagnostics.warning ? "rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-600" : "rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-600"}>
                  {({ "no-match": "لا توجد مفاتيح متطابقة", "one-to-one": "واحد إلى واحد", "one-to-many": "واحد إلى متعدد", "many-to-one": "متعدد إلى واحد", "many-to-many": "متعدد إلى متعدد" } as const)[joinDiagnostics.relationship]}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <div><p className="text-muted-foreground">صفوف المصدر الأيسر</p><p dir="ltr" className="font-mono font-semibold">{joinDiagnostics.leftRows.toLocaleString("en-US")}</p></div>
                <div><p className="text-muted-foreground">صفوف المصدر الأيمن</p><p dir="ltr" className="font-mono font-semibold">{joinDiagnostics.rightRows.toLocaleString("en-US")}</p></div>
                <div><p className="text-muted-foreground">صفوف الناتج</p><p dir="ltr" className="font-mono font-semibold">{joinDiagnostics.joinedRows.toLocaleString("en-US")}</p></div>
                <div><p className="text-muted-foreground">معامل التضخم</p><p dir="ltr" className="font-mono font-semibold">{joinDiagnostics.expansionFactor.toFixed(2)}×</p></div>
              </div>
              <p className="text-[11px] text-muted-foreground">مفاتيح متطابقة: {joinDiagnostics.matchedKeyGroups.toLocaleString("en-US")} · مجموعات مكررة يساراً: {joinDiagnostics.leftDuplicateKeyGroups.toLocaleString("en-US")} · يميناً: {joinDiagnostics.rightDuplicateKeyGroups.toLocaleString("en-US")}</p>
              {joinDiagnostics.reasons.length > 0 && (
                <ul className="list-inside list-disc space-y-1 text-xs text-amber-600">
                  {joinDiagnostics.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
