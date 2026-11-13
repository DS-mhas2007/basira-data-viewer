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
  const [failed, setFailed] = useState(false);

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
    const resizeChart = () => chart?.resize();

    void import("echarts")
      .then(({ init }) => {
        if (disposed || !host.isConnected) return;

        chart = init(host, undefined, { renderer: "canvas" });
        chartRef.current = chart;
        setReady(true);

        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => chart?.resize());
          resizeObserver.observe(host);
        } else {
          window.addEventListener("resize", resizeChart);
        }
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resizeChart);
      chart?.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready || !chartRef.current) return;
    const chart = chartRef.current;
    try {
      chart.setOption(option, { notMerge: true, lazyUpdate: true });
    } catch {
      chart.dispose();
      chartRef.current = null;
      setFailed(true);
    }
  }, [option, ready]);

  if (failed) {
    return (
      <div className={className} role="status" aria-live="polite">
        تعذّر تهيئة الرسم البياني أو عرضه. أعد تحميل الصفحة للمحاولة مجدداً.
      </div>
    );
  }

  return (
    <div
      ref={hostRef}
      className={className}
      role="img"
      aria-label={label}
      aria-busy={!ready}
    />
  );
}
