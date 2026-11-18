/**
 * لوحة القيادة المباشرة: ويدجت رسوم يبنيها المستخدم، تُحفظ محلياً وتتحدث فوراً مع البيانات.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, type MotionStyle } from "framer-motion";

import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { duckdb, type TableInfo } from "@/lib/duckdb-service";
import {
  AGGS,
  CHART_KINDS,
  CHART_ROW_CAP,
  TIME_BUCKETS,
  buildSql,
  capRows,
  formatValue,
  isTemporalColumn,
  normalizeChartRows,
  type ChartConfig,
  type TimeBucket,
} from "@/lib/chart-studio";
import {
  createWidget,
  loadBoard,
  migrateBoard,
  reflowBoard,
  saveBoard,
  starterBoard,
  type BoardWidget,
  type WidgetSize,
} from "@/lib/dashboard-board";
import { cn } from "@/lib/utils";
import { ChartSkeleton } from "@/components/ChartSkeleton";
import { glassBrand, sliceColors } from "@/lib/echarts-glass";
import { useTheme } from "@/lib/theme";
import { EChartsView } from "@/components/EChartsView";

interface Props {
  tableInfo: TableInfo | null;
  boardKey: string;
  sourceKey: string;
}

interface Point {
  label: string;
  value: number;
}

function WidgetChart({ cfg, data }: { cfg: ChartConfig; data: Point[] }) {
  return <EChartsView config={cfg} points={data} glassBare />;
}

/** عدّاد يصعد من الصفر إلى القيمة (يحترم تقليل الحركة). */
function useCountUp(target: number, duration = 900): number {
  const [v, setV] = useState(target);
  useEffect(() => {
    const reduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !Number.isFinite(target)) {
      setV(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setV(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setV(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

function KpiBox({
  value,
  number,
  format,
  label,
  dot,
  className,
}: {
  value?: string;
  /** إن مُرّر مع format يُعرض العدّاد المتحرك بدل value. */
  number?: number;
  format?: (n: number) => string;
  label: string;
  dot?: string;
  className?: string;
}) {
  const counted = useCountUp(number ?? 0);
  const shown = number !== undefined && format ? format(counted) : (value ?? "");
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-xl border border-foreground/15 bg-foreground/[0.04] px-3.5 py-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/.06)]",
        className,
      )}
    >
      {dot && (
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: dot, boxShadow: `0 0 10px ${dot}` }}
        />
      )}
      <div className="min-w-0">
        <div className="truncate font-mono text-lg font-semibold leading-none tracking-tight text-foreground">
          {shown}
        </div>
        <div className="mt-1 truncate text-[11px] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

/** جسم الويدجت بتخطيط المرجع: لكل نوع رسم أسلوب عرضه (KPI داخل لوحة، أو علبتان جانبيتان). */
function WidgetBody({
  cfg,
  data,
  loading,
  error,
  kpi,
  size,
}: {
  cfg: ChartConfig;
  data: Point[];
  loading: boolean;
  error: string | null;
  kpi: { value: number; label: string };
  size: WidgetSize;
}) {
  useTheme();
  const brand = glassBrand();
  if (loading)
    return (
      <div className="relative h-64 w-full" role="status" aria-label="جارٍ تحميل الرسم">
        <div className="mz-skel-pulse absolute start-0 top-0 h-12 w-32 rounded-xl border border-foreground/10 bg-foreground/[0.04]" />
        <ChartSkeleton kind={cfg.kind === "pie" ? "pie" : cfg.kind === "bar" ? "bar" : "line"} />
      </div>
    );
  if (error)
    return (
      <div className="flex h-64 items-center justify-center text-xs text-destructive">{error}</div>
    );
  if (data.length === 0)
    return (
      <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
        لم يُسفر هذا الإعداد عن نتائج — جرّب عموداً آخر
      </div>
    );

  const total = data.reduce((s, d) => s + d.value, 0);
  const top = [...data].sort((a, b) => b.value - a.value);
  const fmt = (v: number) => formatValue(v, cfg);

  if (cfg.kind === "pie") {
    const ring = sliceColors(data.length);
    return (
      <div className="flex flex-col gap-3">
        <div className="h-52 w-full">
          <WidgetChart cfg={cfg} data={data} />
        </div>
        <div className="grid gap-2">
          {data.slice(0, 3).map((d, i) => (
            <KpiBox
              key={d.label}
              dot={ring[i]!}
              number={d.value}
              format={fmt}
              label={`${d.label} · ${total > 0 ? Math.round((d.value / total) * 100) : 0}%`}
            />
          ))}
        </div>
      </div>
    );
  }

  if (cfg.kind === "area" || cfg.kind === "line") {
    return (
      <div className="flex h-full flex-col rounded-2xl border border-foreground/12 bg-foreground/[0.03] p-3">
        <KpiBox number={kpi.value} format={fmt} label={kpi.label} className="mb-1 w-fit" />
        <div className={cn("min-h-56 w-full flex-1", size === "lg" && "min-h-72")}>
          <WidgetChart cfg={cfg} data={data} />
        </div>
      </div>
    );
  }

  // أعمدة/مركّب: الرسم مع علبتي KPI جانبيتين بنقطتين (تيل ولافندر) كما في المرجع
  const second = top[0];
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
      <div className="h-60 min-w-0 shrink-0 md:flex-1 md:shrink">
        <WidgetChart cfg={cfg} data={data} />
      </div>
      {size !== "sm" && (
        <div className="flex shrink-0 gap-2 md:w-40 md:flex-col md:justify-center">
          <KpiBox
            dot={brand.teal}
            number={kpi.value}
            format={fmt}
            label={kpi.label}
            className="flex-1 md:flex-none"
          />
          {second && (
            <KpiBox
              dot={brand.lav}
              number={second.value}
              format={fmt}
              label={`الأعلى: ${second.label}`}
              className="flex-1 md:flex-none"
            />
          )}
        </div>
      )}
    </div>
  );
}

function WidgetCard({
  index,
  widget,
  tableInfo,
  sourceKey,
  onChange,
  onRemove,
  onMove,
  onMoveBy,
}: {
  index: number;
  widget: BoardWidget;
  tableInfo: TableInfo;
  sourceKey: string;
  onChange: (w: BoardWidget) => void;
  onRemove: () => void;
  onMove: (draggedId: string, targetId: string) => void;
  onMoveBy: (direction: -1 | 1) => void;
}) {
  const [data, setData] = useState<Point[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const cfg = widget.config;
  const sql = useMemo(() => buildSql(tableInfo, cfg), [tableInfo, cfg]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    duckdb
      .runSelect(sql, {
        limit: cfg.limit > 0 ? Math.min(cfg.limit, CHART_ROW_CAP + 1) : CHART_ROW_CAP + 1,
      })
      .then((fetched) => {
        if (!alive) return;
        const { rows, truncated: cut } = capRows(fetched);
        setTruncated(cut);
        // Keep missing/invalid values out of the chart instead of silently plotting them as zero.
        setData(normalizeChartRows(rows).points);
      })
      .catch(() => alive && setError("تعذّر حساب هذا الويدجت"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [sql, sourceKey, cfg.limit]);

  const total = data.reduce((s, d) => s + d.value, 0);
  // الرقم الرئيسي يتبع دالة التجميع: جمع المتوسطات أو الأعداد المتباينة لا معنى له.
  const values = data.map((d) => d.value);
  const kpi =
    cfg.agg === "AVG"
      ? { value: values.length ? total / values.length : 0, label: "متوسط الفئات" }
      : cfg.agg === "MAX"
        ? { value: values.length ? Math.max(...values) : 0, label: "الأعلى" }
        : cfg.agg === "MIN"
          ? { value: values.length ? Math.min(...values) : 0, label: "الأدنى" }
          : { value: total, label: cfg.agg === "COUNT" ? "العدد" : "الإجمالي" };
  const columns = tableInfo.schema;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.08, ease: [0.22, 1, 0.36, 1] }}
      exit={{ opacity: 0, scale: 0.97 }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const draggedId = event.dataTransfer.getData("text/plain");
        if (draggedId && draggedId !== widget.id) onMove(draggedId, widget.id);
      }}
      style={
        {
          "--canvas-column": `${(widget.layout?.x ?? 0) + 1} / span ${widget.layout?.w ?? 6}`,
          "--canvas-row": `${(widget.layout?.y ?? 0) + 1} / span ${widget.layout?.h ?? 8}`,
        } as MotionStyle
      }
      className="mz-glass-card mz-glass-card--teal mz-board-card col-span-1 flex flex-col rounded-3xl p-5 lg:[grid-column:var(--canvas-column)] lg:[grid-row:var(--canvas-row)]"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-foreground">{cfg.title}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {data.length} فئة{truncated ? ` · أول ${CHART_ROW_CAP} فقط` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded-full border border-border bg-foreground/5 px-2.5 py-1 text-[11px] text-muted-foreground">
            {AGGS.find((a) => a.id === cfg.agg)?.label ?? cfg.agg} · {cfg.y}
          </span>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => setEditing((v) => !v)}
            aria-pressed={editing}
            aria-label={editing ? "إخفاء إعدادات الويدجت" : "تعديل الويدجت"}
            title={editing ? "إخفاء الإعدادات" : "تعديل"}
            className={cn(
              "size-8 rounded-lg text-muted-foreground",
              editing && "bg-primary/15 text-primary",
            )}
          >
            <SlidersHorizontal className="size-4" strokeWidth={2} />
          </Button>
        </div>
      </div>

      {editing && (
        <div className="mb-3 space-y-2 rounded-xl border border-border bg-foreground/[0.03] p-3">
          <div className="flex items-start gap-2">
            <button
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", widget.id);
              }}
              className="mt-1 cursor-grab rounded-lg p-1 text-muted-foreground active:cursor-grabbing"
              aria-label="اسحب لتحريك الويدجت"
              title="اسحب لتحريك الويدجت"
            >
              <GripVertical className="size-4" strokeWidth={2} />
            </button>
            <div className="min-w-0 flex-1">
              <Input
                value={cfg.title}
                onChange={(e) => onChange({ ...widget, config: { ...cfg, title: e.target.value } })}
                className="h-8 border-0 bg-transparent px-0 text-sm font-semibold focus-visible:ring-0"
              />
              <p className="font-mono text-[11px] text-muted-foreground">
                {formatValue(total, cfg)} · {data.length} فئة
                {truncated ? ` (أول ${CHART_ROW_CAP} فقط)` : ""}
              </p>
            </div>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onMoveBy(-1)}
              className="size-8 rounded-lg text-muted-foreground"
              aria-label="تحريك الويدجت للأعلى"
            >
              <ArrowUp className="size-4" strokeWidth={2} />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => onMoveBy(1)}
              className="size-8 rounded-lg text-muted-foreground"
              aria-label="تحريك الويدجت للأسفل"
            >
              <ArrowDown className="size-4" strokeWidth={2} />
            </Button>
            <Select
              value={widget.size}
              onValueChange={(value) => onChange({ ...widget, size: value as WidgetSize })}
            >
              <SelectTrigger
                className="h-8 w-[5.5rem] rounded-lg px-2 text-[11px]"
                aria-label="حجم الويدجت"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sm" className="text-xs">
                  صغير
                </SelectItem>
                <SelectItem value="md" className="text-xs">
                  متوسط
                </SelectItem>
                <SelectItem value="lg" className="text-xs">
                  عريض
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={onRemove}
              className="size-8 rounded-lg text-muted-foreground hover:text-destructive"
              aria-label="حذف الويدجت"
            >
              <Trash2 className="size-4" strokeWidth={2} />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Select
              value={cfg.kind}
              onValueChange={(v) =>
                onChange({ ...widget, config: { ...cfg, kind: v as ChartConfig["kind"] } })
              }
            >
              <SelectTrigger className="h-8 rounded-lg text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_KINDS.map((k) => (
                  <SelectItem key={k.id} value={k.id} className="text-xs">
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={cfg.x}
              onValueChange={(v) => onChange({ ...widget, config: { ...cfg, x: v } })}
            >
              <SelectTrigger className="h-8 rounded-lg text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((c) => (
                  <SelectItem key={c.name} value={c.name} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isTemporalColumn(tableInfo, cfg.x) && (
              <Select
                value={cfg.bucket ?? "none"}
                onValueChange={(v) =>
                  onChange({
                    ...widget,
                    config: { ...cfg, bucket: v === "none" ? undefined : (v as TimeBucket) },
                  })
                }
              >
                <SelectTrigger className="h-8 rounded-lg text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_BUCKETS.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs">
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select
              value={cfg.y}
              onValueChange={(v) => onChange({ ...widget, config: { ...cfg, y: v } })}
            >
              <SelectTrigger className="h-8 rounded-lg text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((c) => (
                  <SelectItem key={c.name} value={c.name} className="text-xs">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={cfg.agg}
              onValueChange={(v) =>
                onChange({ ...widget, config: { ...cfg, agg: v as ChartConfig["agg"] } })
              }
            >
              <SelectTrigger className="h-8 rounded-lg text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGGS.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="text-xs">
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        <WidgetBody
          cfg={cfg}
          data={data}
          loading={loading}
          error={error}
          kpi={kpi}
          size={widget.size}
        />
      </div>
    </motion.div>
  );
}

export function DashboardBuilder({ tableInfo, boardKey, sourceKey }: Props) {
  const [widgets, setWidgets] = useState<BoardWidget[]>([]);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    setWidgets(loadBoard(boardKey).widgets);
  }, [boardKey]);

  const persist = useCallback(
    (next: BoardWidget[]) => {
      const normalized = migrateBoard({ widgets: next });
      setWidgets(normalized.widgets);
      if (!saveBoard(boardKey, normalized)) {
        toast.error("تعذّر حفظ تغييرات اللوحة محلياً؛ تحقق من مساحة التخزين");
      }
    },
    [boardKey],
  );

  const moveWidget = useCallback(
    (draggedId: string, targetId: string) => {
      const from = widgets.findIndex((widget) => widget.id === draggedId);
      const to = widgets.findIndex((widget) => widget.id === targetId);
      if (from < 0 || to < 0 || from === to) return;
      const reordered = [...widgets];
      const [dragged] = reordered.splice(from, 1);
      if (!dragged) return;
      reordered.splice(to, 0, dragged);
      persist(reflowBoard(reordered));
    },
    [persist, widgets],
  );

  const moveWidgetBy = useCallback(
    (widgetId: string, direction: -1 | 1) => {
      const from = widgets.findIndex((widget) => widget.id === widgetId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= widgets.length) return;
      const reordered = [...widgets];
      const [moved] = reordered.splice(from, 1);
      if (!moved) return;
      reordered.splice(to, 0, moved);
      persist(reflowBoard(reordered));
    },
    [persist, widgets],
  );

  if (!tableInfo) return null;

  return (
    <div className="space-y-4">
      <div className="mz-glass-card mz-glass-card--dual flex flex-wrap items-center gap-2 rounded-2xl px-4 py-3">
        <LayoutGrid className="size-5 text-primary" strokeWidth={2} />
        <p className="text-sm font-medium">
          {widgets.length ? `${widgets.length} ويدجت في لوحتك` : "لوحة فارغة — ابدأ بلوحة مقترحة"}
        </p>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              persist([...widgets, ...starterBoard(tableInfo)]);
              toast.success("أُضيفت لوحة مقترحة من أعمدة ملفك");
            }}
            className="clay-press gap-1.5 rounded-xl text-xs"
          >
            <Sparkles className="size-3.5" strokeWidth={2} />
            لوحة مقترحة
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => persist([...widgets, createWidget(tableInfo, { title: "ويدجت جديد" })])}
            className="clay-press gap-1.5 rounded-xl text-xs"
          >
            <Plus className="size-3.5" strokeWidth={2} />
            ويدجت
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setNonce((n) => n + 1)}
            className="clay-press gap-1.5 rounded-xl text-xs"
          >
            <RefreshCw className="size-3.5" strokeWidth={2} />
            تحديث
          </Button>
        </div>
      </div>

      <div
        className="mz-board-glow relative grid grid-cols-1 gap-5 lg:grid-cols-12"
        style={{ gridAutoRows: "minmax(1.5rem, auto)" }}
      >
        <AnimatePresence>
          {widgets.map((w, index) => (
            <WidgetCard
              key={w.id}
              index={index}
              widget={w}
              tableInfo={tableInfo}
              sourceKey={`${sourceKey}:${nonce}`}
              onChange={(next) => {
                const updated = widgets.map((x) => (x.id === w.id ? next : x));
                persist(next.size !== w.size ? reflowBoard(updated) : updated);
              }}
              onRemove={() => persist(widgets.filter((x) => x.id !== w.id))}
              onMove={moveWidget}
              onMoveBy={(direction) => moveWidgetBy(w.id, direction)}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
