/**
 * استوديو تخصيص الرسوم البيانية: معاينة حية + 4 تبويبات تحكم.
 * كل الاستعلامات تُنفَّذ محلياً عبر DuckDB-WASM.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Label,
  LabelList,
  Legend,
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
  Camera,
  Copy,
  Loader2,
  Palette as PaletteIcon,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { duckdb, type TableInfo } from "@/lib/duckdb-service";
import { isNumericType } from "@/lib/profile";
import {
  AGGS,
  buildSql,
  CHART_KINDS,
  defaultConfig,
  formatValue,
  PALETTES,
  SORTS,
  type ChartConfig,
} from "@/lib/chart-studio";

interface Point {
  label: string;
  value: number;
}

const AXIS = { fontSize: 11, fill: "var(--muted-foreground)" } as const;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <UiLabel className="text-xs text-muted-foreground">{label}</UiLabel>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="clay-inset flex items-center justify-between rounded-xl px-3 py-2.5">
      <span className="text-xs font-medium">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export function ChartStudioModal({
  open,
  onOpenChange,
  tableInfo,
  seedTitle,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tableInfo: TableInfo | null;
  seedTitle?: string;
}) {
  const initial = useMemo(
    () => (tableInfo ? defaultConfig(tableInfo, seedTitle) : null),
    [tableInfo, seedTitle],
  );
  const [cfg, setCfg] = useState<ChartConfig | null>(initial);
  const [data, setData] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCfg(initial);
  }, [initial]);

  const set = useCallback(
    <K extends keyof ChartConfig>(key: K, value: ChartConfig[K]) =>
      setCfg((c) => (c ? { ...c, [key]: value } : c)),
    [],
  );

  const sql = useMemo(
    () => (tableInfo && cfg ? buildSql(tableInfo, cfg) : ""),
    [tableInfo, cfg],
  );

  // إعادة الاستعلام فقط عند تغيّر البيانات/المحاور — تغييرات التنسيق فورية بلا استعلام.
  useEffect(() => {
    if (!open || !sql) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void duckdb
      .runSelect(sql, { limit: 500 })
      .then((rows) => {
        if (cancelled) return;
        setData(
          rows.map((r) => ({
            label: String(r["label"] ?? "—"),
            value: Number(r["value"]) || 0,
          })),
        );
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "تعذّر تنفيذ الاستعلام");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sql]);

  if (!cfg || !tableInfo) return null;

  const colorAt = (i: number) => cfg.colors[i % cfg.colors.length] ?? "#60F5D2";
  const fmt = (v: number) => formatValue(v, cfg);

  const exportPng = async () => {
    const node = previewRef.current;
    if (!node) return;
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(node, { pixelRatio: 3, backgroundColor: "#010A19", cacheBust: true });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cfg.title.replace(/[\\/:*?"<>|]/g, "") || "chart"}.png`;
      a.click();
      toast.success("تم تصدير الرسم بدقة عالية");
    } catch {
      toast.error("تعذّر تصدير الصورة");
    }
  };

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      toast.success("تم نسخ كود SQL");
    } catch {
      toast.error("تعذّر الوصول إلى الحافظة");
    }
  };

  const tooltipStyle = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    fontSize: 12,
  } as const;

  const legendEl =
    cfg.legend === "hidden" ? null : (
      <Legend verticalAlign={cfg.legend} wrapperStyle={{ fontSize: 11 }} />
    );
  const gridEl = cfg.grid ? (
    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
  ) : null;
  const xAxis = (
    <XAxis
      dataKey="label"
      tick={{ ...AXIS, angle: cfg.xAngle, textAnchor: cfg.xAngle === 0 ? "middle" : "end" }}
      height={cfg.xAngle === 0 ? 28 : 62}
      interval={0}
      tickLine={false}
      axisLine={false}
    />
  );
  const yAxis = (
    <YAxis tick={AXIS} tickLine={false} axisLine={false} width={56} tickFormatter={fmt} />
  );
  const labels = cfg.dataLabels ? (
    <LabelList dataKey="value" position="top" formatter={fmt} className="fill-foreground text-[10px]" />
  ) : null;

  const gradientDefs = (
    <defs>
      {cfg.colors.map((c, i) => (
        <linearGradient key={i} id={`studio-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity={0.95} />
          <stop offset="100%" stopColor={c} stopOpacity={cfg.gradient ? 0.15 : 0.95} />
        </linearGradient>
      ))}
    </defs>
  );
  const fillOf = (i: number) => (cfg.gradient ? `url(#studio-grad-${i})` : colorAt(i));

  function renderChart() {
    const c = cfg!;
    switch (c.kind) {
      case "line":
        return (
          <LineChart data={data}>
            {gradientDefs}
            {gridEl}
            {xAxis}
            {yAxis}
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
            {legendEl}
            <Line
              name={c.y}
              type={c.curve}
              dataKey="value"
              stroke={colorAt(0)}
              strokeWidth={2.5}
              dot={{ r: 3, fill: colorAt(0) }}
            >
              {labels}
            </Line>
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={data}>
            {gradientDefs}
            {gridEl}
            {xAxis}
            {yAxis}
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
            {legendEl}
            <Area
              name={c.y}
              type={c.curve}
              dataKey="value"
              stroke={colorAt(0)}
              strokeWidth={2.5}
              fill={fillOf(0)}
            >
              {labels}
            </Area>
          </AreaChart>
        );
      case "pie":
        return (
          <PieChart>
            {gradientDefs}
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
            {legendEl}
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="45%"
              outerRadius="78%"
              paddingAngle={2}
              label={c.dataLabels ? (e: { value: number }) => fmt(e.value) : false}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={colorAt(i)} stroke="var(--background)" strokeWidth={2} />
              ))}
              <Label
                value={fmt(data.reduce((s, d) => s + d.value, 0))}
                position="center"
                className="fill-foreground font-bold"
                fontSize={16}
              />
            </Pie>
          </PieChart>
        );
      case "combo":
        return (
          <ComposedChart data={data}>
            {gradientDefs}
            {gridEl}
            {xAxis}
            {yAxis}
            <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmt(v)} />
            {legendEl}
            <Bar name={c.y} dataKey="value" fill={fillOf(0)} radius={[c.radius, c.radius, 0, 0]}>
              {labels}
            </Bar>
            <Line
              name="الاتجاه"
              type={c.curve}
              dataKey="value"
              stroke={colorAt(1)}
              strokeWidth={2.5}
              dot={false}
            />
          </ComposedChart>
        );
      default:
        return (
          <BarChart data={data} stackOffset={c.kind === "stacked" ? "expand" : undefined}>
            {gradientDefs}
            {gridEl}
            {xAxis}
            {yAxis}
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.25 }}
              contentStyle={tooltipStyle}
              formatter={(v: number) => fmt(v)}
            />
            {legendEl}
            <Bar name={c.y} dataKey="value" radius={[c.radius, c.radius, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={c.kind === "stacked" ? fillOf(i) : fillOf(0)} />
              ))}
              {labels}
            </Bar>
          </BarChart>
        );
    }
  }

  const alignClass =
    cfg.align === "center" ? "text-center" : cfg.align === "left" ? "text-left" : "text-right";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-h-[92vh] max-w-6xl gap-0 overflow-y-auto border-white/10 bg-card/95 p-0 backdrop-blur-xl"
      >
        <DialogHeader className="border-b border-border/60 px-5 py-3 text-right">
          <DialogTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="size-4 text-accent" strokeWidth={2} />
            استوديو تخصيص الرسم البياني
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-0 lg:grid-cols-5">
          {/* المعاينة الحية */}
          <div className="space-y-3 border-border/60 p-4 lg:col-span-3 lg:border-l">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="clay-press gap-1.5 text-xs" onClick={() => void exportPng()}>
                <Camera className="size-3.5" strokeWidth={2} /> تصدير HD PNG
              </Button>
              <Button size="sm" variant="outline" className="clay-press gap-1.5 text-xs" onClick={() => void copySql()}>
                <Copy className="size-3.5" strokeWidth={2} /> نسخ كود SQL
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="clay-press gap-1.5 text-xs"
                onClick={() => {
                  setCfg(initial);
                  toast.success("تمت إعادة الضبط");
                }}
              >
                <RotateCcw className="size-3.5" strokeWidth={2} /> إعادة ضبط
              </Button>
            </div>

            <div
              ref={previewRef}
              className="clay space-y-2 rounded-2xl border border-white/10 bg-background/70 p-4"
            >
              <div className={alignClass}>
                <p dir="auto" className="font-display text-base font-bold">
                  {cfg.title}
                </p>
                {cfg.subtitle && (
                  <p dir="auto" className="text-xs text-muted-foreground">
                    {cfg.subtitle}
                  </p>
                )}
              </div>
              <div className="h-[320px] tabular-nums">
                {error ? (
                  <div className="flex h-full items-center justify-center px-6 text-center text-xs text-destructive">
                    {error}
                  </div>
                ) : data.length === 0 && loading ? (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" strokeWidth={2} />
                  </div>
                ) : data.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    لا توجد نتائج لهذه الإعدادات
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    {renderChart()}
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground">
              {data.length} صف · تنفيذ محلي عبر DuckDB-WASM
            </p>
          </div>

          {/* لوحة التحكم */}
          <div className="p-4 lg:col-span-2">
            <Tabs defaultValue="data">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="data" className="text-xs">
                  <SlidersHorizontal className="size-3.5" strokeWidth={2} />
                </TabsTrigger>
                <TabsTrigger value="style" className="text-xs">
                  <PaletteIcon className="size-3.5" strokeWidth={2} />
                </TabsTrigger>
                <TabsTrigger value="text" className="text-xs">
                  <Type className="size-3.5" strokeWidth={2} />
                </TabsTrigger>
                <TabsTrigger value="axes" className="text-xs">
                  <Settings2 className="size-3.5" strokeWidth={2} />
                </TabsTrigger>
              </TabsList>

              <AnimatePresence mode="wait">
                <motion.div
                  key="panels"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="mt-4"
                >
                  <TabsContent value="data" className="space-y-3">
                    <Field label="نوع الرسم">
                      <Select value={cfg.kind} onValueChange={(v) => set("kind", v as ChartConfig["kind"])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CHART_KINDS.map((k) => (
                            <SelectItem key={k.id} value={k.id}>{k.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="المحور الأفقي (X)">
                      <Select value={cfg.x} onValueChange={(v) => set("x", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {tableInfo.schema.map((c) => (
                            <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="المحور العمودي (Y)">
                      <Select value={cfg.y} onValueChange={(v) => set("y", v)} disabled={cfg.agg === "COUNT"}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {tableInfo.schema
                            .filter((c) => isNumericType(c.type))
                            .map((c) => (
                              <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="دالة التجميع">
                      <Select value={cfg.agg} onValueChange={(v) => set("agg", v as ChartConfig["agg"])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AGGS.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="الترتيب">
                      <Select value={cfg.sort} onValueChange={(v) => set("sort", v as ChartConfig["sort"])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SORTS.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={`عدد العناصر: ${cfg.limit === 0 ? "الكل" : cfg.limit}`}>
                      <Slider
                        dir="rtl"
                        value={[cfg.limit === 0 ? 20 : cfg.limit]}
                        min={5}
                        max={20}
                        step={5}
                        onValueChange={([v]) => set("limit", v === 20 ? 0 : (v ?? 10))}
                      />
                    </Field>
                  </TabsContent>

                  <TabsContent value="style" className="space-y-3">
                    <Field label="السمة اللونية">
                      <div className="grid grid-cols-2 gap-2">
                        {PALETTES.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              set("palette", p.id);
                              set("colors", [...p.colors]);
                            }}
                            className={`clay-press space-y-1.5 rounded-xl border px-2.5 py-2 text-right transition ${
                              cfg.palette === p.id
                                ? "border-primary/60 bg-primary/10"
                                : "border-border/70 hover:bg-muted/40"
                            }`}
                          >
                            <span className="block text-[11px] font-medium">{p.name}</span>
                            <span className="flex gap-1">
                              {p.colors.slice(0, 5).map((c) => (
                                <span key={c} className="size-3 rounded-full" style={{ background: c }} />
                              ))}
                            </span>
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="ألوان السلاسل">
                      <div className="flex flex-wrap gap-2">
                        {cfg.colors.map((c, i) => (
                          <input
                            key={i}
                            type="color"
                            value={c}
                            aria-label={`لون السلسلة ${i + 1}`}
                            onChange={(e) => {
                              const next = [...cfg.colors];
                              next[i] = e.target.value;
                              set("colors", next);
                              set("palette", "custom");
                            }}
                            className="size-8 cursor-pointer rounded-lg border border-border/70 bg-transparent p-0.5"
                          />
                        ))}
                      </div>
                    </Field>
                    <ToggleRow label="تدرج لوني شفاف" checked={cfg.gradient} onChange={(v) => set("gradient", v)} />
                    <Field label={`انحناء زوايا الأعمدة: ${cfg.radius}px`}>
                      <Slider dir="rtl" value={[cfg.radius]} min={0} max={16} step={1} onValueChange={([v]) => set("radius", v ?? 0)} />
                    </Field>
                    <ToggleRow
                      label="منحنيات ناعمة (Monotone)"
                      checked={cfg.curve === "monotone"}
                      onChange={(v) => set("curve", v ? "monotone" : "linear")}
                    />
                  </TabsContent>

                  <TabsContent value="text" className="space-y-3">
                    <Field label="عنوان الرسم">
                      <Input value={cfg.title} onChange={(e) => set("title", e.target.value)} />
                    </Field>
                    <Field label="الوصف الفرعي">
                      <Input value={cfg.subtitle} onChange={(e) => set("subtitle", e.target.value)} />
                    </Field>
                    <Field label="محاذاة النص">
                      <Select value={cfg.align} onValueChange={(v) => set("align", v as ChartConfig["align"])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="right">يمين</SelectItem>
                          <SelectItem value="center">وسط</SelectItem>
                          <SelectItem value="left">يسار</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="بادئة (ر.س / $)">
                        <Input value={cfg.prefix} onChange={(e) => set("prefix", e.target.value)} placeholder="$" />
                      </Field>
                      <Field label="لاحقة (% / وحدة)">
                        <Input value={cfg.suffix} onChange={(e) => set("suffix", e.target.value)} placeholder="%" />
                      </Field>
                    </div>
                    <ToggleRow label="اختصار الأرقام (1.2M)" checked={cfg.compact} onChange={(v) => set("compact", v)} />
                    <ToggleRow label="إظهار القيم على الرسم" checked={cfg.dataLabels} onChange={(v) => set("dataLabels", v)} />
                  </TabsContent>

                  <TabsContent value="axes" className="space-y-3">
                    <ToggleRow label="شبكة الخلفية" checked={cfg.grid} onChange={(v) => set("grid", v)} />
                    <Field label="موقع دليل الألوان">
                      <Select value={cfg.legend} onValueChange={(v) => set("legend", v as ChartConfig["legend"])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top">أعلى</SelectItem>
                          <SelectItem value="bottom">أسفل</SelectItem>
                          <SelectItem value="hidden">مخفي</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={`تدوير نصوص المحور: ${cfg.xAngle}°`}>
                      <Slider
                        dir="rtl"
                        value={[Math.abs(cfg.xAngle)]}
                        min={0}
                        max={90}
                        step={45}
                        onValueChange={([v]) => set("xAngle", (-(v ?? 0)) as ChartConfig["xAngle"])}
                      />
                    </Field>
                  </TabsContent>
                </motion.div>
              </AnimatePresence>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
