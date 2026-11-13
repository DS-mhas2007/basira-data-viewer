/**
 * لوحة القيادة المباشرة: ويدجت رسوم يبنيها المستخدم، تُحفظ محلياً وتتحدث فوراً مع البيانات.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, type MotionStyle } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  LayoutGrid,
  Loader2,
  Plus,
  RefreshCw,
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
import { AGGS, CHART_KINDS, buildSql, formatValue, normalizeChartRows, type ChartConfig } from "@/lib/chart-studio";
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

interface Props {
  tableInfo: TableInfo | null;
  boardKey: string;
  sourceKey: string;
}

interface Point {
  label: string;
  value: number;
}

const AXIS = { fontSize: 10, fill: "var(--muted-foreground)" } as const;
function WidgetChart({ cfg, data }: { cfg: ChartConfig; data: Point[] }) {
  const colors = cfg.colors.length ? cfg.colors : ["var(--primary)"];
  const common = { data, margin: { top: 8, right: 8, left: 8, bottom: 24 } };
  const axes = (
    <>
      {cfg.grid && <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.35} />}
      <XAxis dataKey="label" tick={AXIS} interval={0} angle={cfg.xAngle} height={44} textAnchor="end" />
      <YAxis tick={AXIS} width={48} tickFormatter={(v: number) => formatValue(v, cfg)} />
      <Tooltip
        contentStyle={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          boxShadow: "0 8px 24px rgb(0 0 0 / 0.18)",
          fontSize: 12,
        }}
        formatter={(v: number) => formatValue(v, cfg)}
      />
    </>
  );

  if (cfg.kind === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }} formatter={(v: number) => formatValue(v, cfg)} />
          <Pie data={data} dataKey="value" nameKey="label" innerRadius="45%" outerRadius="78%">
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  }
  if (cfg.kind === "line" || cfg.kind === "combo") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart {...common}>
          {axes}
          <Line type={cfg.curve} dataKey="value" stroke={colors[0]} strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }
  if (cfg.kind === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart {...common}>
          <defs>
            <linearGradient id={`g-${cfg.x}-${cfg.y}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colors[0]} stopOpacity={0.55} />
              <stop offset="100%" stopColor={colors[0]} stopOpacity={0.04} />
            </linearGradient>
          </defs>
          {axes}
          <Area
            type={cfg.curve}
            dataKey="value"
            stroke={colors[0]}
            strokeWidth={2.5}
            fill={`url(#g-${cfg.x}-${cfg.y})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart {...common}>
        {axes}
        <Bar dataKey="value" radius={[cfg.radius, cfg.radius, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function WidgetCard({
  widget,
  tableInfo,
  sourceKey,
  onChange,
  onRemove,
  onMove,
  onMoveBy,
}: {
  widget: BoardWidget;
  tableInfo: TableInfo;
  sourceKey: string;
  onChange: (w: BoardWidget) => void;
  onRemove: () => void;
  onMove: (draggedId: string, targetId: string) => void;
  onMoveBy: (direction: -1 | 1) => void;
}) {
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cfg = widget.config;
  const sql = useMemo(() => buildSql(tableInfo, cfg), [tableInfo, cfg]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    duckdb
      .runSelect(sql, { limit: Math.max(cfg.limit, 50) })
      .then((rows) => {
        if (!alive) return;
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
  const columns = tableInfo.schema;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const draggedId = event.dataTransfer.getData("text/plain");
        if (draggedId && draggedId !== widget.id) onMove(draggedId, widget.id);
      }}
      style={{
        "--canvas-column": `${(widget.layout?.x ?? 0) + 1} / span ${widget.layout?.w ?? 6}`,
        "--canvas-row": `${(widget.layout?.y ?? 0) + 1} / span ${widget.layout?.h ?? 8}`,
      } as MotionStyle}
      className="clay col-span-1 rounded-2xl border border-border/60 bg-card/60 p-4 lg:[grid-column:var(--canvas-column)] lg:[grid-row:var(--canvas-row)]"
    >
      <div className="mb-3 flex items-start gap-2">
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
          <SelectTrigger className="h-8 w-[5.5rem] rounded-lg px-2 text-[11px]" aria-label="حجم الويدجت">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sm" className="text-xs">صغير</SelectItem>
            <SelectItem value="md" className="text-xs">متوسط</SelectItem>
            <SelectItem value="lg" className="text-xs">عريض</SelectItem>
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

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select
          value={cfg.kind}
          onValueChange={(v) => onChange({ ...widget, config: { ...cfg, kind: v as ChartConfig["kind"] } })}
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
        <Select value={cfg.x} onValueChange={(v) => onChange({ ...widget, config: { ...cfg, x: v } })}>
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
        <Select value={cfg.y} onValueChange={(v) => onChange({ ...widget, config: { ...cfg, y: v } })}>
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
          onValueChange={(v) => onChange({ ...widget, config: { ...cfg, agg: v as ChartConfig["agg"] } })}
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

      <div className={cn("w-full", widget.size === "lg" ? "h-72" : "h-56")}>
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="size-5 animate-spin" strokeWidth={2} />
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-xs text-destructive">{error}</div>
        ) : data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            لا توجد نتائج لهذا الإعداد
          </div>
        ) : (
          <WidgetChart cfg={cfg} data={data} />
        )}
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
      <div className="clay flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12" style={{ gridAutoRows: "minmax(1.5rem, auto)" }}>
        <AnimatePresence initial={false}>
          {widgets.map((w) => (
            <WidgetCard
              key={w.id}
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
