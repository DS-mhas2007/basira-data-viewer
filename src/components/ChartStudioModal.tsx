/**
 * استوديو تخصيص الرسوم البيانية: معاينة حية + 4 تبويبات تحكم.
 * كل الاستعلامات تُنفَّذ محلياً عبر DuckDB-WASM.
 */
import { friendlyError } from "@/lib/friendly-error";
import { glassMode } from "@/lib/echarts-glass";
import { EChartsView } from "@/components/EChartsView";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import {
  Camera,
  Copy,
  Loader2,
  Palette as PaletteIcon,
  RotateCcw,
  Sparkles,
  Settings2,
  SlidersHorizontal,
  Type,
} from "@/components/icons";
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
import { ChartDataTable } from "@/components/ChartDataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { duckdb, type TableInfo } from "@/lib/duckdb-service";
import { isNumericType } from "@/lib/profile";
import {
  chartToCsv,
  chartToSvg,
  missingColumns,
  parseChartConfigFile,
  PNG_SCALES,
  serializeChartConfig,
} from "@/lib/chart-export";
import {
  buildSourceStatsSql,
  buildTrustSummary,
  parseSourceStats,
  type SourceStats,
} from "@/lib/chart-trust";
import {
  AGGS,
  buildSql,
  CHART_KINDS,
  defaultConfig,
  normalizeChartRows,
  PALETTES,
  SORTS,
  CHART_ROW_CAP,
  TIME_BUCKETS,
  capRows,
  activeSeries,
  activeY2,
  isTemporalColumn,
  KIND_REQUIREMENTS,
  SERIES_CAP,
  SERIES_KINDS,
  kindFieldProblem,
  recommendChartKind,
  resolveChartFit,
  type ChartConfig,
  type ChartPoint,
  type TimeBucket,
} from "@/lib/chart-studio";

const NONE = "__none__";

/** خلفية صورة PNG تطابق سطح المعاينة (وإلا ظهر النص الفاتح على أرضية كريمية). */
function exportBackground(): string {
  const mode = glassMode();
  return mode === "dark" ? "#0B1B33" : mode === "light" ? "#FFFFFF" : "#FAF8F1";
}

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
    <div className="mz-glass-inset flex items-center justify-between rounded-xl px-3 py-2.5">
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
  const [data, setData] = useState<ChartPoint[]>([]);
  const [omittedValues, setOmittedValues] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [seriesTotal, setSeriesTotal] = useState<number | null>(null);
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

  const sql = useMemo(() => (tableInfo && cfg ? buildSql(tableInfo, cfg) : ""), [tableInfo, cfg]);

  // إعادة الاستعلام فقط عند تغيّر البيانات/المحاور — تغييرات التنسيق فورية بلا استعلام.
  useEffect(() => {
    if (!open || !sql) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOmittedValues(0);
    setTruncated(false);
    void duckdb
      .runSelect(sql, { limit: CHART_ROW_CAP + 1 })
      .then((fetched) => {
        if (cancelled) return;
        const { rows, truncated: cut } = capRows(fetched);
        setTruncated(cut);
        const normalized = normalizeChartRows(rows);
        setData(normalized.points);
        setOmittedValues(normalized.omitted);
        setSeriesTotal(normalized.seriesTotal ?? null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(friendlyError(e, "تعذّر تنفيذ الاستعلام"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sql]);

  const [pngScale, setPngScale] = useState<number>(3);
  const [transparent, setTransparent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [sourceStats, setSourceStats] = useState<SourceStats | null>(null);
  const statsKey = tableInfo && cfg ? `${tableInfo.table}|${cfg.x}|${cfg.y}` : "";
  useEffect(() => {
    if (!open || !tableInfo || !cfg) return;
    let cancelled = false;
    setSourceStats(null);
    void duckdb
      .runSelect(buildSourceStatsSql(tableInfo, cfg), { limit: 1 })
      .then((rows) => {
        if (!cancelled) setSourceStats(parseSourceStats(rows[0]));
      })
      .catch(() => {
        if (!cancelled) setSourceStats(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, statsKey]);

  if (!cfg || !tableInfo) return null;

  const recommendation = recommendChartKind(
    tableInfo,
    cfg.x,
    loading || error ? [] : data,
    !loading && !error && cfg.limit === 0 && !truncated && omittedValues === 0,
  );

  const kindRequirement = KIND_REQUIREMENTS[cfg.kind];
  const seriesShown = new Set(data.map((p) => p.series).filter((v) => v !== undefined)).size;
  const seriesNote =
    activeSeries(tableInfo, cfg) && seriesTotal !== null && seriesTotal > seriesShown
      ? `عُرضت أعلى ${seriesShown} سلاسل من ${seriesTotal}؛ استُبعدت الباقية.`
      : null;
  const y2Note =
    cfg.kind === "combo" && cfg.y2 && !activeY2(tableInfo, cfg)
      ? "المقياس الثاني غير مفعّل (يجب أن يكون عموداً رقمياً مختلفاً وبدالة غير «عدد»)."
      : null;

  const kindNotice =
    kindFieldProblem(tableInfo, cfg) ??
    y2Note ??
    seriesNote ??
    (loading || error || data.length === 0 ? null : resolveChartFit(cfg.kind, data).notice);

  const trust =
    loading || error || data.length === 0
      ? null
      : buildTrustSummary(tableInfo, cfg, sourceStats, new Set(data.map((p) => p.label)).size);

  const exportPng = async () => {
    const node = previewRef.current;
    if (!node) return;
    try {
      const { toPng } = await import("html-to-image");
      const url = await toPng(node, {
        pixelRatio: pngScale,
        ...(transparent ? {} : { backgroundColor: exportBackground() }),
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cfg.title.replace(/[\\/:*?"<>|]/g, "") || "chart"}.png`;
      a.click();
      toast.success("حُفظ الرسم بدقة عالية");
    } catch {
      toast.error("تعذّر تصدير الصورة");
    }
  };

  const baseName = () => cfg.title.replace(/[\\/:*?"<>|]/g, "") || "chart";
  const saveBlob = (content: BlobPart, type: string, ext: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName()}.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportSvg = async () => {
    try {
      saveBlob(
        await chartToSvg(cfg, data, { background: transparent ? null : exportBackground() }),
        "image/svg+xml",
        "svg",
      );
      toast.success("حُفظ SVG");
    } catch {
      toast.error("تعذّر تصدير SVG");
    }
  };
  const exportCsv = () => {
    saveBlob(chartToCsv(data, cfg), "text/csv;charset=utf-8", "csv");
    toast.success("حُفظت البيانات المرسومة CSV");
  };
  const exportConfig = () => {
    saveBlob(serializeChartConfig(cfg), "application/json", "mizyai-chart.json");
    toast.success("حُفظ ملف الإعدادات (بدون بيانات)");
  };
  const importConfig = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 100_000) return void toast.error("الملف كبير على أن يكون ملف إعدادات");
    const parsed = parseChartConfigFile(await file.text());
    if (!parsed.ok) return void toast.error(parsed.error);
    const missing = missingColumns(
      parsed.config,
      tableInfo.schema.map((c) => c.name),
    );
    const safe = { ...parsed.config };
    for (const k of ["x", "y", "series", "y2"] as const) {
      if (missing.includes(safe[k] as string)) delete safe[k];
    }
    setCfg((c) => (c ? { ...c, ...safe } : c));
    if (missing.length)
      toast.warning(`أعمدة غير موجودة في هذا الجدول وتم تجاهلها: ${missing.join("، ")}`);
    else toast.success("طُبّقت الإعدادات");
  };

  const copySql = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      toast.success("نُسخ استعلام SQL");
    } catch {
      toast.error("تعذّر الوصول إلى الحافظة");
    }
  };

  const alignClass =
    cfg.align === "center" ? "text-center" : cfg.align === "left" ? "text-left" : "text-right";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="mz-glass-card mz-glass-card--dual max-h-[92vh] max-w-6xl gap-0 overflow-y-auto p-0"
      >
        <DialogHeader className="border-b border-white/[0.08] px-5 py-3 text-right">
          <DialogTitle className="flex items-center gap-2 text-base">
            <SlidersHorizontal className="size-4 text-accent" strokeWidth={2} />
            استوديو تخصيص الرسم البياني
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-0 lg:grid-cols-5">
          {/* المعاينة الحية */}
          <div className="space-y-3 border-border/60 p-4 lg:col-span-3 lg:border-l">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="clay-press gap-1.5 text-xs"
                onClick={() => void exportPng()}
              >
                <Camera className="size-3.5" strokeWidth={2} /> تصدير HD PNG
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="clay-press gap-1.5 text-xs"
                onClick={() => void copySql()}
              >
                <Copy className="size-3.5" strokeWidth={2} /> نسخ كود SQL
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="clay-press text-xs"
                onClick={() => void exportSvg()}
              >
                SVG
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="clay-press text-xs"
                onClick={exportCsv}
                disabled={data.length === 0}
              >
                CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="clay-press text-xs"
                onClick={exportConfig}
              >
                حفظ الإعدادات
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="clay-press text-xs"
                onClick={() => fileRef.current?.click()}
              >
                فتح إعدادات
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  void importConfig(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                دقة PNG
                <select
                  className="rounded border border-white/10 bg-transparent px-1 py-0.5"
                  value={pngScale}
                  onChange={(e) => setPngScale(Number(e.target.value))}
                >
                  {PNG_SCALES.map((n) => (
                    <option key={n} value={n} className="text-black">
                      {n}×
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <input
                  type="checkbox"
                  checked={transparent}
                  onChange={(e) => setTransparent(e.target.checked)}
                />
                خلفية شفافة
              </label>
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
              className="mz-glass-card mz-glass-card--teal space-y-2 rounded-2xl p-4"
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
                    لم تُسفر هذه الإعدادات عن نتائج — جرّب تغيير العمود أو المُرشِّح
                  </div>
                ) : (
                  <EChartsView config={cfg} points={data} label={cfg.title} />
                )}
              </div>
            </div>
            {kindNotice && (
              <p
                role="status"
                className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed"
              >
                {kindNotice}
              </p>
            )}
            {!loading && !error && data.length > 0 && <ChartDataTable config={cfg} points={data} />}
            {trust && trust.warnings.length > 0 && (
              <ul
                aria-label="تنبيهات التفسير"
                className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed"
              >
                {trust.warnings.map((w) => (
                  <li key={w}>⚠ {w}</li>
                ))}
              </ul>
            )}
            {trust && <p className="text-[11px] text-muted-foreground">{trust.basis}</p>}
            <p className="font-mono text-[10px] text-muted-foreground">
              {data.length} قيمة مرسومة · تنفيذ محلي عبر DuckDB-WASM
              {omittedValues > 0 ? ` · استُبعدت ${omittedValues} قيمة مفقودة أو غير صالحة` : ""}
              {truncated
                ? ` · معروض أول ${CHART_ROW_CAP} فقط، ضيّق التصفية أو استخدم التجميع الزمني`
                : ""}
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
                    <div className="mz-glass-inset space-y-2 rounded-xl border border-primary/15 p-3">
                      <div className="flex items-center gap-2 text-xs font-semibold">
                        <Sparkles className="size-3.5 text-accent" strokeWidth={2} />
                        اقتراح نوع الرسم
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {recommendation.reason}
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="clay-press h-8 text-xs"
                        onClick={() =>
                          setCfg((current) =>
                            current
                              ? {
                                  ...current,
                                  kind: recommendation.kind,
                                  sort: recommendation.sort ?? current.sort,
                                }
                              : current,
                          )
                        }
                        disabled={
                          cfg.kind === recommendation.kind &&
                          (!recommendation.sort || cfg.sort === recommendation.sort)
                        }
                      >
                        استخدم الرسم {recommendation.label}
                        {recommendation.sort === "label_asc" ? " مع ترتيب زمني" : ""}
                      </Button>
                    </div>
                    <Field label="نوع الرسم">
                      <Select
                        value={cfg.kind}
                        onValueChange={(v) => set("kind", v as ChartConfig["kind"])}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CHART_KINDS.map((k) => (
                            <SelectItem key={k.id} value={k.id}>
                              {k.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {kindRequirement && (
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {kindRequirement}
                        </p>
                      )}
                    </Field>
                    <Field label="المحور الأفقي (X)">
                      <Select value={cfg.x} onValueChange={(v) => set("x", v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {tableInfo.schema.map((c) => (
                            <SelectItem key={c.name} value={c.name}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    {isTemporalColumn(tableInfo, cfg.x) && (
                      <Field label="التجميع الزمني">
                        <Select
                          value={cfg.bucket ?? "none"}
                          onValueChange={(v) =>
                            set("bucket", v === "none" ? undefined : (v as TimeBucket))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TIME_BUCKETS.map((b) => (
                              <SelectItem key={b.id} value={b.id}>
                                {b.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                    <Field label="المحور العمودي (Y)">
                      <Select
                        value={cfg.y}
                        onValueChange={(v) => set("y", v)}
                        disabled={cfg.agg === "COUNT"}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {tableInfo.schema
                            .filter((c) => isNumericType(c.type))
                            .map((c) => (
                              <SelectItem key={c.name} value={c.name}>
                                {c.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    {SERIES_KINDS.includes(cfg.kind) && (
                      <Field label="تقسيم السلاسل (Series)">
                        <Select
                          value={cfg.series ?? NONE}
                          onValueChange={(v) => set("series", v === NONE ? undefined : v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>بلا تقسيم</SelectItem>
                            {tableInfo.schema
                              .filter((c) => !isNumericType(c.type) && c.name !== cfg.x)
                              .map((c) => (
                                <SelectItem key={c.name} value={c.name}>
                                  {c.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          تُعرض أعلى {SERIES_CAP} سلاسل بحسب مجموعها، وكل خلية تُجمَّع بالدالة
                          المختارة.
                        </p>
                      </Field>
                    )}
                    {cfg.kind === "combo" && (
                      <Field label="مقياس ثانٍ (محور ثانوي)">
                        <Select
                          value={cfg.y2 ?? NONE}
                          onValueChange={(v) => set("y2", v === NONE ? undefined : v)}
                          disabled={cfg.agg === "COUNT"}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>بلا مقياس ثانٍ</SelectItem>
                            {tableInfo.schema
                              .filter((c) => isNumericType(c.type) && c.name !== cfg.y)
                              .map((c) => (
                                <SelectItem key={c.name} value={c.name}>
                                  {c.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">
                          {cfg.agg === "COUNT"
                            ? "مع «عدد» يتطابق المقياسان، فلا يُستخدم المحور الثانوي."
                            : "المحوران بمقياسين مستقلين: لا تقارن ارتفاع العمود بارتفاع الخط، والتجميع واحد للمقياسين."}
                        </p>
                      </Field>
                    )}
                    {cfg.kind === "stacked" && (
                      <ToggleRow
                        label="تطبيع إلى 100% لكل فئة"
                        checked={cfg.stackPercent === true}
                        onChange={(v) => set("stackPercent", v)}
                      />
                    )}
                    <Field label="دالة التجميع">
                      <Select
                        value={cfg.agg}
                        onValueChange={(v) => set("agg", v as ChartConfig["agg"])}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AGGS.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="الترتيب">
                      <Select
                        value={cfg.sort}
                        onValueChange={(v) => set("sort", v as ChartConfig["sort"])}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SORTS.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.label}
                            </SelectItem>
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
                                <span
                                  key={c}
                                  className="size-3 rounded-full"
                                  style={{ background: c }}
                                />
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
                    <ToggleRow
                      label="تدرج لوني شفاف"
                      checked={cfg.gradient}
                      onChange={(v) => set("gradient", v)}
                    />
                    <Field label={`انحناء زوايا الأعمدة: ${cfg.radius}px`}>
                      <Slider
                        dir="rtl"
                        value={[cfg.radius]}
                        min={0}
                        max={16}
                        step={1}
                        onValueChange={([v]) => set("radius", v ?? 0)}
                      />
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
                      <Input
                        value={cfg.subtitle}
                        onChange={(e) => set("subtitle", e.target.value)}
                      />
                    </Field>
                    <Field label="محاذاة النص">
                      <Select
                        value={cfg.align}
                        onValueChange={(v) => set("align", v as ChartConfig["align"])}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="right">يمين</SelectItem>
                          <SelectItem value="center">وسط</SelectItem>
                          <SelectItem value="left">يسار</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="بادئة (ر.س / $)">
                        <Input
                          value={cfg.prefix}
                          onChange={(e) => set("prefix", e.target.value)}
                          placeholder="$"
                        />
                      </Field>
                      <Field label="لاحقة (% / وحدة)">
                        <Input
                          value={cfg.suffix}
                          onChange={(e) => set("suffix", e.target.value)}
                          placeholder="%"
                        />
                      </Field>
                    </div>
                    <ToggleRow
                      label="اختصار الأرقام (1.2M)"
                      checked={cfg.compact}
                      onChange={(v) => set("compact", v)}
                    />
                    <ToggleRow
                      label="إظهار القيم على الرسم"
                      checked={cfg.dataLabels}
                      onChange={(v) => set("dataLabels", v)}
                    />
                  </TabsContent>

                  <TabsContent value="axes" className="space-y-3">
                    <ToggleRow
                      label="شبكة الخلفية"
                      checked={cfg.grid}
                      onChange={(v) => set("grid", v)}
                    />
                    {cfg.grid && (
                      <Field label="نمط الشبكة">
                        <Select
                          value={cfg.gridStyle ?? "dashed"}
                          onValueChange={(v) => set("gridStyle", v as "dashed" | "solid")}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="dashed">متقطعة</SelectItem>
                            <SelectItem value="solid">متصلة</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                    <ToggleRow
                      label="عناوين المحاور والوحدات"
                      checked={cfg.axisTitles === true}
                      onChange={(v) => set("axisTitles", v)}
                    />
                    <Field label="موقع دليل الألوان">
                      <Select
                        value={cfg.legend}
                        onValueChange={(v) => set("legend", v as ChartConfig["legend"])}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
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
                        onValueChange={([v]) => set("xAngle", -(v ?? 0) as ChartConfig["xAngle"])}
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
