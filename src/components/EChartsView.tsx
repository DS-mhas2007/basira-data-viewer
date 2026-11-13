import { useEffect, useRef, useState } from "react";
import type { ECharts, EChartsOption as NativeEChartsOption } from "echarts";
import { buildEChartsOption } from "@/lib/echarts-adapter";
import type { ChartConfig, ChartPoint } from "@/lib/chart-studio";

interface EChartsViewProps {
  config: ChartConfig;
  points: ChartPoint[];
  className?: string;
  label?: string;
}

/**
 * Client-only ECharts surface. DuckDB remains the source of truth for all data;
 * this component only renders the already-normalized points supplied by callers.
 */
export function EChartsView({
  config,
  points,
  className = "h-full w-full",
  label = "مخطط البيانات",
}: EChartsViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const [ready, setReady] = useState(false);

  // Initialize ECharts once; subsequent data/style changes update the same instance.
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
    chartRef.current.setOption(buildEChartsOption(config, points) as NativeEChartsOption, {
      notMerge: true,
      lazyUpdate: true,
    });
  }, [config, points, ready]);

  return <div ref={hostRef} className={className} role="img" aria-label={label} />;
}
