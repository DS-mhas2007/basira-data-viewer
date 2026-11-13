/**
 * محوّل محايد بين عقد بصيرة للرسوم وخيارات ECharts.
 * لا ينفّذ استعلامات ولا يعيد حساب المؤشرات؛ يستقبل نقاط DuckDB المطبّعة فقط.
 */
import { formatValue, type ChartConfig, type ChartPoint } from "@/lib/chart-studio";

type EChartsSeries = Record<string, unknown>;
export type EChartsOption = Record<string, unknown> & {
  color: string[];
  tooltip: Record<string, unknown>;
  series: EChartsSeries[];
};

function safeColors(config: ChartConfig): string[] {
  const colors = config.colors.filter((color) => /^#[\da-f]{3,8}$/i.test(color));
  return colors.length ? colors : ["#60F5D2", "#D6B2FC", "#7FB2FF", "#F5C978"];
}

/** يبني option قابلاً لتمريره إلى echarts-for-react دون ربط طبقة البيانات بالمكتبة. */
export function buildEChartsOption(config: ChartConfig, points: ChartPoint[]): EChartsOption {
  const colors = safeColors(config);
  const categories = points.map((point) => point.label);
  const values = points.map((point) => point.value);
  const commonSeries = {
    name: config.title,
    data: values,
    itemStyle: { borderRadius: config.radius },
    label: config.dataLabels
      ? {
          show: true,
          position: config.kind === "bar" || config.kind === "stacked" ? "top" : "top",
          color: "inherit",
        }
      : { show: false },
  };

  const axisBase = {
    axisLine: { lineStyle: { color: "var(--border)" } },
    axisLabel: {
      color: "var(--muted-foreground)",
      rotate: config.xAngle,
      hideOverlap: true,
    },
    splitLine: {
      show: config.grid,
      lineStyle: { color: "var(--border)", type: "dashed" },
    },
  };

  const option: EChartsOption = {
    color: colors,
    animation: true,
    grid: { left: 12, right: 16, top: 24, bottom: config.xAngle === 0 ? 24 : 56, containLabel: true },
    tooltip: {
      trigger: config.kind === "pie" ? "item" : "axis",
      valueFormatter: (value: unknown) =>
        typeof value === "number" ? formatValue(value, config) : String(value ?? "—"),
    },
    legend: {
      show: config.legend !== "hidden" && (config.kind === "pie" || config.kind === "combo"),
      bottom: config.legend === "bottom" ? 0 : undefined,
      top: config.legend === "top" ? 0 : undefined,
      textStyle: { color: "var(--muted-foreground)" },
    },
    series: [],
  };

  if (config.kind === "pie") {
    option["grid"] = undefined;
    option.series = [{
      name: config.title,
      type: "pie",
      radius: ["42%", "72%"],
      center: ["50%", "50%"],
      data: points.map((point) => ({ name: point.label, value: point.value })),
      label: config.dataLabels
        ? { show: true, formatter: "{b}: {d}%" }
        : { show: false },
      itemStyle: { borderRadius: config.radius, borderColor: "var(--card)", borderWidth: 2 },
    }];
    return option;
  }

  option["xAxis"] = {
    type: "category",
    data: categories,
    ...axisBase,
  };
  option["yAxis"] = {
    type: "value",
    ...axisBase,
    axisLabel: {
      color: "var(--muted-foreground)",
      formatter: (value: number) => formatValue(value, config),
    },
  };

  if (config.kind === "line" || config.kind === "area") {
    option.series = [{
      ...commonSeries,
      type: "line",
      smooth: config.curve === "monotone",
      symbol: "circle",
      symbolSize: 7,
      areaStyle: config.kind === "area" ? { opacity: config.gradient ? 0.22 : 0.08 } : undefined,
      lineStyle: { width: 3 },
    }];
  } else if (config.kind === "combo") {
    option.series = [
      { ...commonSeries, name: config.title, type: "bar", barMaxWidth: 42 },
      {
        name: `${config.title} — اتجاه`,
        type: "line",
        data: values,
        smooth: config.curve === "monotone",
        symbol: "circle",
        symbolSize: 6,
      },
    ];
  } else {
    option.series = [{
      ...commonSeries,
      type: "bar",
      barMaxWidth: 48,
      stack: config.kind === "stacked" ? "total" : undefined,
    }];
  }

  return option;
}
