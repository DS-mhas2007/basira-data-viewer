import { useEffect, useRef } from "react";
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

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let chart: ECharts | undefined;
    let resizeObserver: ResizeObserver | undefined;

    void import("echarts").then(({ init }) => {
      if (disposed || !host.isConnected) return;

      chart = init(host, undefined, { renderer: "canvas" });
      chart.setOption(buildEChartsOption(config, points) as NativeEChartsOption, {
        notMerge: true,
        lazyUpdate: true,
      });

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => chart?.resize());
        resizeObserver.observe(host);
      }
    });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      chart?.dispose();
    };
  }, [config, points]);

  return <div ref={hostRef} className={className} role="img" aria-label={label} />;
}
