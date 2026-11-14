import { useEffect, useMemo, useRef, useState } from "react";
import type { ECharts, EChartsOption as NativeEChartsOption } from "echarts";
import { buildEChartsOption } from "@/lib/echarts-adapter";
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
}: EChartsViewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const resizeHandlerRef = useRef<(() => void) | null>(null);
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
    const resizeChart = () => chartRef.current?.resize();

    void import("echarts")
      .then(({ init }) => {
        if (disposed || !host.isConnected) return;

        const instance = init(host, undefined, { renderer: "canvas" });
        chartRef.current = instance;
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
    if (!host || !pdfExport || !ready) return;
    registerReportChart(host, option);
    return () => unregisterReportChart(host);
  }, [option, pdfExport, ready]);

  useEffect(() => {
    if (!ready || !chartRef.current) return;
    const chart = chartRef.current;
    try {
      chart.setOption(option, { notMerge: true, lazyUpdate: true });
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
      data-pdf-chart={pdfExport ? "" : undefined}
    />
  );
}
