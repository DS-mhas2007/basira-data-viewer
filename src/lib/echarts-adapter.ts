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
  const configuredColors: unknown = config.colors;
  const colors = Array.isArray(configuredColors)
    ? configuredColors.filter(
        (color): color is string =>
          typeof color === "string" && /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(color),
      )
    : [];
  return colors.length ? colors : ["#60F5D2", "#D6B2FC", "#7FB2FF", "#F5C978"];
}
function colorWithOpacity(hex: string, opacity: number): string {
  const raw = hex.slice(1);
  const expanded = raw.length <= 4 ? [...raw].map((part) => part + part).join("") : raw;
  const rgb = expanded.slice(0, 6);
  const baseOpacity = expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1;
  const channels = [0, 2, 4].map((index) => Number.parseInt(rgb.slice(index, index + 2), 16));
  return `rgba(${channels.join(", ")}, ${Number((baseOpacity * opacity).toFixed(3))})`;
}


/** يبني option قابلاً لتمريره إلى echarts-for-react دون ربط طبقة البيانات بالمكتبة. */
export function buildEChartsOption(config: ChartConfig, points: ChartPoint[]): EChartsOption {
  const colors = safeColors(config);
  const categories = points.map((point) => point.label);
  const values = points.map((point) => point.value);
  const commonSeries = {
    name: config.y,
    data: values,
    itemStyle: { borderRadius: [config.radius, config.radius, 0, 0], color: colors[0] },
    label: config.dataLabels
      ? {
          show: true,
          position: "top",
          color: "inherit",
        }
      : { show: false },
  };

  const axisLine = { lineStyle: { color: "#34445E" } };
  const axisLabel = { color: "#AAB7C9", hideOverlap: true };
  const valueSplitLine = {
    show: config.grid,
    lineStyle: { color: "#34445E", type: "dashed" },
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
      show: config.legend !== "hidden",
      bottom: config.legend === "bottom" ? 0 : undefined,
      top: config.legend === "top" ? 0 : undefined,
      textStyle: { color: "#AAB7C9" },
    },
    series: [],
  };

  if (config.kind === "pie") {
    option["grid"] = undefined;
    option.series = [{
      name: config.y,
      type: "pie",
      radius: ["42%", "72%"],
      center: ["50%", "50%"],
      data: points.map((point) => ({ name: point.label, value: point.value })),
      label: config.dataLabels
        ? {
            show: true,
            formatter: (params: { name?: unknown; value?: unknown }) =>
              `${String(params.name ?? "—")}: ${typeof params.value === "number" ? formatValue(params.value, config) : "—"}`,
          }
        : { show: false },
      itemStyle: { borderRadius: config.radius, borderColor: "#0D1F3C", borderWidth: 2 },
    }];
    return option;
  }

  option["xAxis"] = {
    type: "category",
    data: categories,
    axisLine,
    axisLabel: { ...axisLabel, rotate: config.xAngle },
    // Keep category-axis vertical split lines disabled; horizontal guides belong to the value axis.
    splitLine: { show: false },
  };
  option["yAxis"] = {
    type: "value",
    axisLine,
    axisLabel: {
      ...axisLabel,
      formatter: (value: number) => formatValue(value, config),
    },
    splitLine: valueSplitLine,
  };

  if (config.kind === "line" || config.kind === "area") {
    option.series = [{
      ...commonSeries,
      type: "line",
      smooth: config.curve === "monotone",
      symbol: "circle",
      symbolSize: 7,
      areaStyle: config.kind === "area"
        ? {
            color: config.gradient
              ? {
                  type: "linear",
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: colorWithOpacity(colors[0]!, 0.95) },
                    { offset: 1, color: colorWithOpacity(colors[0]!, 0.15) },
                  ],
                }
              : colors[0],
          }
        : undefined,
      lineStyle: { width: 3 },
    }];
  } else if (config.kind === "combo") {
    option.series = [
      { ...commonSeries, name: config.y, type: "bar", barMaxWidth: 42, itemStyle: { color: colors[0], borderRadius: [config.radius, config.radius, 0, 0] } },
      {
        name: "الاتجاه",
        type: "line",
        data: values,
        smooth: config.curve === "monotone",
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: colors[1] ?? colors[0], width: 3 },
        itemStyle: { color: colors[1] ?? colors[0] },
      },
    ];
  } else {
    option.series = [{
      ...commonSeries,
      type: "bar",
      barMaxWidth: 48,
      stack: config.kind === "stacked" ? "total" : undefined,
      itemStyle: {
        borderRadius: [config.radius, config.radius, 0, 0],
        color: config.kind === "stacked"
          ? undefined
          : colors[0],
      },
      ...(config.kind === "stacked"
        ? {
            data: points.map((point, index) => ({
              name: point.label,
              value: point.value,
              itemStyle: { color: colors[index % colors.length] },
            })),
          }
        : {}),
    }];
  }

  return option;
}
