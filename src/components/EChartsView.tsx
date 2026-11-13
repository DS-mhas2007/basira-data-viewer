import { useEffect, useMemo, useRef, useState } from "react";
import type { ECharts, EChartsOption as NativeEChartsOption } from "echarts";
import { buildEChartsOption } from "@/lib/echarts-adapter";
import type { ChartConfig, ChartPoint } from "@/lib/chart-studio";

interface EChartsViewProps {
  config?: ChartConfig;
  points?: ChartPoint[];
  option?: NativeEChartsOption;
  className?: string;
  label?: string;
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
}: EChartsViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const option = useMemo<NativeEChartsOption>(() => {
    if (suppliedOption) return suppliedOption;
    if (config && points) return buildEChartsOption(config, points) as NativeEChartsOption;
    return {};
  }, [config, points, suppliedOption]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let resizeObserver: ResizeObserver | undefined;
    let chart: ECharts | undefined;

    void import("echarts").then(({ init }) => {
      if (disposed || !host.isConnected) return;

      chart = init(host, undefined, { renderer: "canvas" });
      chartRef.current = chart;
      setReady(true);

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => chart?.resize());
        resizeObserver.observe(host);
      }
    }).catch(() => {
      if (!disposed) setLoadError(true);
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      chart?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !chartRef.current) return;
    chartRef.current.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option, ready]);

  return (
    <div
      ref={hostRef}
      className={`relative ${className}`}
      role="img"
      aria-label={loadError ? `${label} — تعذّر تحميل الرسم` : label}
    >
      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80 px-4 text-center text-xs text-muted-foreground">
          تعذّر تحميل محرّك الرسوم البيانية. أعد تحميل الصفحة للمحاولة مجدداً.
        </div>
      )}
    </div>
  );
}
