import { useEffect, useMemo, useRef, useState } from "react";
import type { ECharts, EChartsOption as NativeEChartsOption } from "echarts";
import { buildEChartsOption, decorateAxes } from "@/lib/echarts-adapter";
import {
  describeChart,
  prefersMoreContrast,
  prefersReducedMotion,
  withA11y,
} from "@/lib/chart-a11y";
import { glassify, isGlassTheme } from "@/lib/echarts-glass";
import {
  isZoomable,
  nextZoomRange,
  withInteraction,
  type ZoomAction,
} from "@/lib/echarts-interaction";
import { useTheme } from "@/lib/theme";
import type { ChartConfig, ChartPoint } from "@/lib/chart-studio";
import { registerReportChart, unregisterReportChart } from "@/lib/report-chart-export";

interface EChartsViewProps {
  config?: ChartConfig;
  points?: ChartPoint[];
  option?: NativeEChartsOption;
  className?: string;
  label?: string;
  /** Register this host and its live option for vector PDF export. */
  pdfExport?: boolean;
  /** نمط اللوحة الزجاجية: دونات/أعمدة بلا مفتاح داخلي (يُعرض بجانبها). */
  glassBare?: boolean;
}

/**
 * Client-only ECharts surface. DuckDB remains the source of truth for data;
 * this component renders either normalized chart points or a prepared option.
 */
export function EChartsView({
  config,
  points,
  option: suppliedOption,
  className = "h-full w-full",
  label = "مخطط البيانات",
  pdfExport = false,
  glassBare = false,
}: EChartsViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeHandlerRef = useRef<(() => void) | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // لا نرسم قبل أن يظهر الرسم في الشاشة، حتى لا تنتهي حركة الدخول قبل أن يراها المستخدم.
  const [visible, setVisible] = useState(false);
  const [drawn, setDrawn] = useState(false);
  const theme = useTheme();
  const option = useMemo<NativeEChartsOption>(() => {
    if (suppliedOption) {
      return isGlassTheme() && !pdfExport
        ? (glassify(suppliedOption as Record<string, unknown>, {
            bare: glassBare,
          }) as NativeEChartsOption)
        : suppliedOption;
    }
    if (config && points) {
      const built = buildEChartsOption(config, points);
      const skinned = isGlassTheme() && !pdfExport ? glassify(built, { bare: glassBare }) : built;
      const decorated = decorateAxes(skinned as Record<string, unknown>, config);
      return (
        pdfExport
          ? decorated
          : withA11y(withInteraction(decorated, config), {
              reducedMotion: prefersReducedMotion(),
              moreContrast: prefersMoreContrast(),
            })
      ) as NativeEChartsOption;
    }
    return {};
  }, [config, points, suppliedOption, pdfExport, glassBare, theme]);

  const [zoom, setZoom] = useState<{ start: number; end: number }>({ start: 0, end: 100 });
  const zoomable = !pdfExport && !!config && isZoomable(option as Record<string, unknown>, config);
  const zoomed = zoom.end - zoom.start < 99.9;

  const applyZoom = (action: ZoomAction) => {
    const chart = chartRef.current;
    if (!chart) return;
    const next = nextZoomRange(zoom.start, zoom.end, action);
    chart.dispatchAction({ type: "dataZoom", start: next.start, end: next.end });
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    const resizeChart = () => chartRef.current?.resize();

    void import("echarts")
      .then(({ init }) => {
        if (disposed || !host.isConnected) return;

        const instance = init(host, undefined, { renderer: "canvas" });
        chartRef.current = instance;
        instance.on?.("datazoom", () => {
          const dz = (instance.getOption() as { dataZoom?: { start?: number; end?: number }[] })
            .dataZoom?.[0];
          if (dz) setZoom({ start: dz.start ?? 0, end: dz.end ?? 100 });
        });
        setReady(true);

        if (typeof ResizeObserver !== "undefined") {
          const observer = new ResizeObserver(resizeChart);
          resizeObserverRef.current = observer;
          observer.observe(host);
        } else {
          resizeHandlerRef.current = resizeChart;
          window.addEventListener("resize", resizeChart);
        }
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });

    return () => {
      disposed = true;
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
      if (resizeHandlerRef.current) {
        window.removeEventListener("resize", resizeHandlerRef.current);
        resizeHandlerRef.current = null;
      }
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (pdfExport || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(host);
    return () => io.disconnect();
  }, [pdfExport]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !pdfExport || !ready) return;
    registerReportChart(host, option);
    return () => unregisterReportChart(host);
  }, [option, pdfExport, ready]);

  useEffect(() => {
    if (!ready || !visible || !chartRef.current) return;
    const chart = chartRef.current;
    setZoom({ start: 0, end: 100 });
    try {
      chart.setOption(option, { notMerge: true, lazyUpdate: true });
      setDrawn(true);
    } catch {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (resizeHandlerRef.current) {
        window.removeEventListener("resize", resizeHandlerRef.current);
        resizeHandlerRef.current = null;
      }
      chart.dispose();
      chartRef.current = null;
      setFailed(true);
    }
  }, [option, ready, visible]);

  if (failed) {
    return (
      <div className={className} role="status" aria-live="polite">
        تعذّر تهيئة الرسم البياني أو عرضه. أعد تحميل الصفحة للمحاولة مجدداً.
      </div>
    );
  }

  const seriesType = (option as { series?: { type?: string }[] }).series?.[0]?.type;
  const skeletonKind: "pie" | "line" | "bar" =
    seriesType === "pie" ? "pie" : seriesType === "line" ? "line" : "bar";

  const onKeyDown = (e: React.KeyboardEvent) => {
    const map: Record<string, ZoomAction> = {
      "+": "in",
      "=": "in",
      "-": "out",
      ArrowLeft: "left",
      ArrowRight: "right",
      "0": "reset",
      Escape: "reset",
    };
    const action = map[e.key];
    if (!action) return;
    e.preventDefault();
    applyZoom(action);
  };

  const description = config && points ? describeChart(config, points) : label;
  const chartEl = (
    <div
      ref={hostRef}
      className={zoomable ? "h-full w-full" : className}
      role="img"
      aria-label={description}
      aria-busy={!drawn}
      data-pdf-chart={pdfExport ? "" : undefined}
      data-skeleton={drawn || pdfExport ? undefined : skeletonKind}
    />
  );
  if (!zoomable) return chartEl;

  const btn =
    "rounded-md border border-white/10 bg-black/20 px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2";
  return (
    <div
      className={`${className} relative`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-keyshortcuts="+ - ArrowLeft ArrowRight 0"
      aria-label={`${description} — اضغط + و − للتكبير والأسهم للتنقل و 0 لإعادة الضبط`}
    >
      {chartEl}
      <div className="absolute start-1 top-0 flex items-center gap-1" dir="rtl">
        {zoomed && (
          <span className="text-[11px] text-muted-foreground" role="status" aria-live="polite">
            عرض جزئي {Math.round(zoom.end - zoom.start)}٪ من البيانات
          </span>
        )}
        <button type="button" className={btn} onClick={() => applyZoom("in")} aria-label="تكبير">
          +
        </button>
        <button type="button" className={btn} onClick={() => applyZoom("out")} aria-label="تصغير">
          −
        </button>
        {zoomed && (
          <button type="button" className={btn} onClick={() => applyZoom("reset")}>
            إعادة الضبط
          </button>
        )}
      </div>
    </div>
  );
}
