/**
 * لوحة القيادة المباشرة: ويدجت رسوم يبنيها المستخدم، تُحفظ محلياً وتتحدث فوراً مع البيانات.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
  LayoutGrid,
  Loader2,
  Maximize2,
  Minimize2,
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
import { AGGS, CHART_KINDS, buildSql, formatValue, type ChartConfig } from "@/lib/chart-studio";
import {
  SIZE_CLASS,
  createWidget,
  loadBoard,
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
const NEXT_SIZE: Record<WidgetSize, WidgetSize> = { sm: "md", md: "lg", lg: "sm" };

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
          borderRadius: 12,
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
          <Tooltip formatter={(v: number) => formatValue(v, cfg)} />
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
}: {
  widget: BoardWidget;
  tableInfo: TableInfo;
  sourceKey: string;
  onChange: (w: BoardWidget) => void;
  onRemove: () => void;
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
        setData(
          rows.map((r) => ({
            label: String((r as Record<string, unknown>)["label"] ?? "—"),
            value: Number((r as Record<string, unknown>)["value"] ?? 0),
          })),
        );
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
      className={cn("clay col-span-1 rounded-2xl border border-border/60 bg-card/60 p-4", SIZE_CLASS[widget.size])}
    >
      <div className="mb-3 flex items-start gap-2">
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
          onClick={() => onChange({ ...widget, size: NEXT_SIZE[widget.size] })}
          className="size-8 rounded-lg text-muted-foreground"
          aria-label="تغيير الحجم"
        >
          {widget.size === "lg" ? (
            <Minimize2 className="size-4" strokeWidth={2} />
          ) : (
            <Maximize2 className="size-4" strokeWidth={2} />
          )}
        </Button>
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
      setWidgets(next);
      saveBoard(boardKey, { widgets: next });
    },
    [boardKey],
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <AnimatePresence initial={false}>
          {widgets.map((w) => (
            <WidgetCard
              key={w.id}
              widget={w}
              tableInfo={tableInfo}
              sourceKey={`${sourceKey}:${nonce}`}
              onChange={(next) => persist(widgets.map((x) => (x.id === w.id ? next : x)))}
              onRemove={() => persist(widgets.filter((x) => x.id !== w.id))}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
