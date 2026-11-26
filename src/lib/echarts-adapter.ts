/**
 * محوّل محايد بين عقد MIZYAi للرسوم وخيارات ECharts.
 * لا ينفّذ استعلامات ولا يعيد حساب المؤشرات؛ يستقبل نقاط DuckDB المطبّعة فقط.
 */
import {
  formatValue,
  resolveChartFit,
  SERIES_KINDS,
  type ChartConfig,
  type ChartPoint,
} from "@/lib/chart-studio";

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
          typeof color === "string" &&
          /^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(color),
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
export function buildEChartsOption(requested: ChartConfig, points: ChartPoint[]): EChartsOption {
  // عند عدم تحقق متطلبات النوع نرسم بديلاً آمناً (أعمدة) بدل رسم مضلل أو فارغ.
  const fit = resolveChartFit(requested.kind, points);
  const config = fit.kind === requested.kind ? requested : { ...requested, kind: fit.kind };
  const colors = safeColors(config);
  // تسميات المجالات ("0 – 5") تُعزل كنص LTR وإلا انعكست داخل صفحة RTL ("5 – 0").
  const categories = points.map((point) =>
    requested.kind === "histogram" ? `\u2066${point.label}\u2069` : point.label,
  );
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
  // تسميات الفئات الطويلة تُقتطع بنقاط؛ الاسم الكامل يظهر في التلميح.
  const axisLabel = { color: "#AAB7C9", hideOverlap: true, width: 96, overflow: "truncate" };
  const valueSplitLine = {
    show: config.grid,
    lineStyle: { color: "#34445E", type: config.gridStyle ?? "dashed" },
  };

  const option: EChartsOption = {
    color: colors,
    animation: true,
    grid: {
      left: 12,
      right: 16,
      top: 24,
      bottom: config.xAngle === 0 ? 24 : 56,
      containLabel: true,
    },
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
    option.series = [
      {
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
      },
    ];
    return option;
  }

  const hasSeries = points.some((point) => point.series !== undefined);
  if (hasSeries && SERIES_KINDS.includes(config.kind)) {
    return buildSeriesOption(config, points, option, colors, {
      axisLine,
      axisLabel,
      valueSplitLine,
    });
  }

  if (config.kind === "combo" && points.some((point) => point.value2 !== undefined)) {
    const secondary = points.map((point) => point.value2 ?? null);
    const lineColor = colors[1] ?? colors[0]!;
    const plain = { ...config, prefix: "", suffix: "" };
    option["grid"] = { ...(option["grid"] as object), right: 20, top: 48 };
    option["tooltip"] = {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (value: unknown) =>
        typeof value === "number" ? formatValue(value, plain) : String(value ?? "—"),
    };
    option["xAxis"] = {
      type: "category",
      data: categories,
      axisLine,
      axisLabel: { ...axisLabel, rotate: config.xAngle },
      splitLine: { show: false },
    };
    option["yAxis"] = [
      {
        type: "value",
        name: config.y,
        nameTextStyle: { color: colors[0], align: "right" },
        axisLine: { show: true, lineStyle: { color: colors[0] } },
        axisLabel: { ...axisLabel, formatter: (value: number) => formatValue(value, config) },
        splitLine: valueSplitLine,
      },
      {
        type: "value",
        name: config.y2,
        nameTextStyle: { color: lineColor, align: "left" },
        axisLine: { show: true, lineStyle: { color: lineColor } },
        axisLabel: { ...axisLabel, formatter: (value: number) => formatValue(value, plain) },
        splitLine: { show: false },
      },
    ];
    option.series = [
      {
        ...commonSeries,
        name: config.y,
        type: "bar",
        yAxisIndex: 0,
        barMaxWidth: 42,
        itemStyle: { color: colors[0], borderRadius: [config.radius, config.radius, 0, 0] },
      },
      {
        name: config.y2,
        type: "line",
        yAxisIndex: 1,
        data: secondary,
        smooth: config.curve === "monotone",
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { color: lineColor, width: 3 },
        itemStyle: { color: lineColor },
        connectNulls: false,
      },
    ];
    return option;
  }

  if (config.kind === "funnel") {
    option["grid"] = undefined;
    option["legend"] = { ...(option["legend"] as object), show: false };
    const sorted = [...points].sort((a, b) => b.value - a.value);
    option["tooltip"] = {
      trigger: "item",
      valueFormatter: (value: unknown) =>
        typeof value === "number" ? formatValue(value, config) : String(value ?? "—"),
    };
    option.series = [
      {
        name: config.y,
        type: "funnel",
        sort: "descending",
        left: "8%",
        right: "8%",
        top: 12,
        bottom: 12,
        gap: 3,
        minSize: "8%",
        data: sorted.map((point) => ({ name: point.label, value: point.value })),
        label: {
          show: true,
          position: "inside",
          formatter: (params: { name?: unknown; value?: unknown }) =>
            `${String(params.name ?? "—")}  ${typeof params.value === "number" ? formatValue(params.value, config) : ""}`,
        },
        itemStyle: { borderColor: "#0D1F3C", borderWidth: 1 },
      },
    ];
    return option;
  }

  if (config.kind === "treemap") {
    option["grid"] = undefined;
    option["legend"] = { ...(option["legend"] as object), show: false };
    option["tooltip"] = {
      trigger: "item",
      valueFormatter: (value: unknown) =>
        typeof value === "number" ? formatValue(value, config) : String(value ?? "—"),
    };
    option.series = [
      {
        name: config.y,
        type: "treemap",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        left: 8,
        right: 8,
        top: 8,
        bottom: 8,
        data: points.map((point, index) => ({
          name: point.label,
          value: point.value,
          itemStyle: { color: colors[index % colors.length] },
        })),
        label: {
          show: true,
          formatter: (params: { name?: unknown; value?: unknown }) =>
            `${String(params.name ?? "—")}\n${typeof params.value === "number" ? formatValue(params.value, config) : ""}`,
          color: "#0B1220",
        },
        itemStyle: {
          borderColor: "#0D1F3C",
          borderWidth: 2,
          gapWidth: 2,
          borderRadius: config.radius / 2,
        },
      },
    ];
    return option;
  }

  if (config.kind === "radar") {
    option["grid"] = undefined;
    option["legend"] = { ...(option["legend"] as object), show: false };
    option["tooltip"] = { trigger: "item" };
    const maxValue = Math.max(...values, 0) * 1.15 || 1;
    option["radar"] = {
      radius: "66%",
      indicator: points.map((point) => ({ name: point.label, max: maxValue })),
      axisName: { color: "#AAB7C9" },
      splitLine: { lineStyle: { color: "#34445E" } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: "#34445E" } },
    };
    option.series = [
      {
        name: config.y,
        type: "radar",
        data: [{ name: config.y, value: values }],
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2.5, color: colors[0] },
        itemStyle: { color: colors[0] },
        areaStyle: { color: colorWithOpacity(colors[0]!, 0.28) },
      },
    ];
    return option;
  }

  if (config.kind === "scatter") {
    option["grid"] = { left: 12, right: 24, top: 24, bottom: 36, containLabel: true };
    option["legend"] = { ...(option["legend"] as object), show: false };
    option["tooltip"] = {
      trigger: "item",
      formatter: (params: { value?: unknown }) => {
        const v = params.value as [number, number] | undefined;
        return v
          ? `${config.x}: ${formatValue(v[0], config)}<br/>${config.y}: ${formatValue(v[1], config)}`
          : "";
      },
    };
    const scatterAxis = (name: string) => ({
      type: "value",
      name,
      nameLocation: "middle",
      nameGap: 28,
      nameTextStyle: { color: "#AAB7C9" },
      scale: true,
      axisLine,
      axisLabel: { ...axisLabel, formatter: (value: number) => formatValue(value, config) },
      splitLine: valueSplitLine,
    });
    option["xAxis"] = scatterAxis(config.x);
    option["yAxis"] = { ...scatterAxis(config.y), nameLocation: "end", nameGap: 12 };
    option.series = [
      {
        name: config.y,
        type: "scatter",
        data: points.map((point) => [point.x ?? 0, point.value]),
        symbolSize: 8,
        itemStyle: {
          color: colorWithOpacity(colors[0]!, 0.7),
          borderColor: colors[0],
          borderWidth: 1,
        },
        large: points.length > 2000,
      },
    ];
    return option;
  }

  if (config.kind === "boxplot") {
    option["legend"] = { ...(option["legend"] as object), show: false };
    option["tooltip"] = {
      trigger: "item",
      formatter: (params: { name?: unknown; data?: unknown }) => {
        const d = params.data as number[] | undefined;
        if (!d || d.length < 5) return "";
        const [lo, q1, med, q3, hi] = d.length >= 6 ? d.slice(1) : d;
        return [
          `<b>${String(params.name ?? "")}</b>`,
          `الأعلى: ${formatValue(hi!, config)}`,
          `الربيع الأعلى: ${formatValue(q3!, config)}`,
          `الوسيط: ${formatValue(med!, config)}`,
          `الربيع الأدنى: ${formatValue(q1!, config)}`,
          `الأدنى: ${formatValue(lo!, config)}`,
        ].join("<br/>");
      },
    };
    option["xAxis"] = {
      type: "category",
      data: categories,
      axisLine,
      axisLabel: { ...axisLabel, rotate: config.xAngle },
      splitLine: { show: false },
    };
    option["yAxis"] = {
      type: "value",
      scale: true,
      axisLine,
      axisLabel: { ...axisLabel, formatter: (value: number) => formatValue(value, config) },
      splitLine: valueSplitLine,
    };
    option.series = [
      {
        name: config.y,
        type: "boxplot",
        data: points.map((point) => point.stats),
        boxWidth: ["30%", "60%"],
        itemStyle: {
          color: colorWithOpacity(colors[0]!, 0.3),
          borderColor: colors[0],
          borderWidth: 2,
        },
      },
    ];
    return option;
  }

  if (config.kind === "waterfall") {
    let cumulative = 0;
    const base: number[] = [];
    const up: (number | string)[] = [];
    const down: (number | string)[] = [];
    for (const value of values) {
      const start = cumulative;
      cumulative += value;
      base.push(Math.min(start, cumulative));
      up.push(value >= 0 ? value : "-");
      down.push(value < 0 ? -value : "-");
    }
    const total = cumulative;
    const labels = [...categories, "الإجمالي"];
    option["legend"] = { ...(option["legend"] as object), show: false };
    option["tooltip"] = {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params: unknown) => {
        const list = params as { dataIndex: number; axisValueLabel?: string }[];
        const index = list[0]?.dataIndex ?? 0;
        if (index >= values.length) {
          return `<b>الإجمالي</b><br/>${formatValue(total, config)}`;
        }
        const delta = values[index]!;
        return `<b>${String(list[0]?.axisValueLabel ?? categories[index] ?? "")}</b><br/>التغيّر: ${delta >= 0 ? "+" : "−"}${formatValue(Math.abs(delta), config)}`;
      },
    };
    option["xAxis"] = {
      type: "category",
      data: labels,
      axisLine,
      axisLabel: { ...axisLabel, rotate: config.xAngle },
      splitLine: { show: false },
    };
    option["yAxis"] = {
      type: "value",
      axisLine,
      axisLabel: { ...axisLabel, formatter: (value: number) => formatValue(value, config) },
      splitLine: valueSplitLine,
    };
    const upColor = colors[0]!;
    const downColor = "#FB7185";
    const totalColor = colors[1] ?? colors[0]!;
    option.series = [
      {
        name: "base",
        type: "bar",
        stack: "waterfall",
        silent: true,
        itemStyle: { color: "transparent" },
        emphasis: { disabled: true },
        data: [...base, 0],
      },
      {
        name: "زيادة",
        type: "bar",
        stack: "waterfall",
        barMaxWidth: 42,
        itemStyle: { color: upColor, borderRadius: [config.radius, config.radius, 0, 0] },
        data: [...up, "-"],
        label: config.dataLabels
          ? {
              show: true,
              position: "top",
              formatter: (p: { value?: unknown }) =>
                typeof p.value === "number" ? `\u2066+${formatValue(p.value, config)}\u2069` : "",
            }
          : { show: false },
      },
      {
        name: "نقصان",
        type: "bar",
        stack: "waterfall",
        barMaxWidth: 42,
        itemStyle: { color: downColor, borderRadius: [config.radius, config.radius, 0, 0] },
        data: [...down, "-"],
        label: config.dataLabels
          ? {
              show: true,
              position: "top",
              formatter: (p: { value?: unknown }) =>
                typeof p.value === "number" ? `\u2066−${formatValue(p.value, config)}\u2069` : "",
            }
          : { show: false },
      },
      {
        name: "الإجمالي",
        type: "bar",
        stack: "waterfall",
        barMaxWidth: 42,
        itemStyle: { color: totalColor, borderRadius: [config.radius, config.radius, 0, 0] },
        data: [...values.map(() => "-"), total],
      },
    ];
    return option;
  }

  if (config.kind === "horizontalBar") {
    option["grid"] = {
      left: 20,
      right: 28,
      top: 24,
      bottom: config.legend === "bottom" ? 24 : 16,
      containLabel: true,
    };
    option["tooltip"] = { ...option.tooltip, axisPointer: { type: "shadow" } };
    option["xAxis"] = {
      type: "value",
      axisLine,
      axisLabel: {
        ...axisLabel,
        formatter: (value: number) => formatValue(value, config),
      },
      splitLine: valueSplitLine,
    };
    option["yAxis"] = {
      type: "category",
      data: categories,
      inverse: true,
      axisLine,
      axisLabel: { ...axisLabel, width: 160, overflow: "truncate" },
      splitLine: { show: false },
    };
    option.series = [
      {
        ...commonSeries,
        type: "bar",
        barMaxWidth: 42,
        itemStyle: {
          borderRadius: [0, config.radius, config.radius, 0],
          color: colors[0],
        },
        label: config.dataLabels
          ? { show: true, position: "right", color: "inherit" }
          : { show: false },
      },
    ];
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
    option.series = [
      {
        ...commonSeries,
        type: "line",
        smooth: config.curve === "monotone",
        symbol: "circle",
        symbolSize: 7,
        areaStyle:
          config.kind === "area"
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
      },
    ];
  } else if (config.kind === "combo") {
    option.series = [
      {
        ...commonSeries,
        name: config.y,
        type: "bar",
        barMaxWidth: 42,
        itemStyle: { color: colors[0], borderRadius: [config.radius, config.radius, 0, 0] },
      },
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
  } else if (config.kind === "histogram") {
    option["legend"] = { ...(option["legend"] as object), show: false };
    option["tooltip"] = {
      ...option.tooltip,
      axisPointer: { type: "shadow" },
      valueFormatter: (value: unknown) =>
        typeof value === "number"
          ? `${formatValue(value, { ...config, prefix: "", suffix: "" })} صف`
          : String(value ?? "—"),
    };
    option.series = [
      {
        ...commonSeries,
        name: "التكرار",
        type: "bar",
        barCategoryGap: "6%",
        itemStyle: {
          color: colors[0],
          borderRadius: [Math.min(config.radius, 4), Math.min(config.radius, 4), 0, 0],
        },
      },
    ];
  } else {
    option.series = [
      {
        ...commonSeries,
        type: "bar",
        barMaxWidth: 48,
        itemStyle: {
          borderRadius: [config.radius, config.radius, 0, 0],
          color: colors[0],
        },
      },
    ];
  }

  return option;
}

const EXTRA_SERIES_COLORS = ["#FB7185", "#F59E0B", "#38BDF8", "#A3E635"];

interface AxisStyle {
  axisLine: Record<string, unknown>;
  axisLabel: Record<string, unknown>;
  valueSplitLine: Record<string, unknown>;
}

/** رسوم متعددة السلاسل: أعمدة مجمّعة/مكدسة (مع تطبيع)، خط، مساحة، أفقي، وخريطة حرارية. */
function buildSeriesOption(
  config: ChartConfig,
  points: ChartPoint[],
  base: EChartsOption,
  baseColors: string[],
  style: AxisStyle,
): EChartsOption {
  const option = base;
  const categories: string[] = [];
  const names: string[] = [];
  const cell = new Map<string, number>();
  for (const point of points) {
    const name = point.series ?? "—";
    if (!categories.includes(point.label)) categories.push(point.label);
    if (!names.includes(name)) names.push(name);
    cell.set(`${point.label}\u0000${name}`, point.value);
  }
  const colors = [...baseColors, ...EXTRA_SERIES_COLORS];
  const valueOf = (label: string, name: string): number | null =>
    cell.get(`${label}\u0000${name}`) ?? null;
  const { axisLine, axisLabel, valueSplitLine } = style;

  if (config.kind === "heatmap") {
    const data: [number, number, number][] = [];
    let max = 0;
    let min = Infinity;
    categories.forEach((label, xi) =>
      names.forEach((name, yi) => {
        const v = valueOf(label, name);
        if (v !== null) {
          data.push([xi, yi, v]);
          max = Math.max(max, v);
          min = Math.min(min, v);
        }
      }),
    );
    option["legend"] = { ...(option["legend"] as object), show: false };
    option["grid"] = { left: 12, right: 24, top: 16, bottom: 64, containLabel: true };
    option["tooltip"] = {
      trigger: "item",
      formatter: (params: { value?: unknown }) => {
        const v = params.value as [number, number, number] | undefined;
        return v
          ? `${categories[v[0]] ?? ""} · ${names[v[1]] ?? ""}<br/>${formatValue(v[2], config)}`
          : "";
      },
    };
    option["xAxis"] = {
      type: "category",
      data: categories,
      splitArea: { show: false },
      axisLine,
      axisLabel: { ...axisLabel, rotate: config.xAngle },
    };
    option["yAxis"] = {
      type: "category",
      data: names,
      axisLine,
      axisLabel,
      splitArea: { show: false },
    };
    option["visualMap"] = {
      min: Number.isFinite(min) ? min : 0,
      max: max || 1,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 8,
      itemWidth: 12,
      itemHeight: 140,
      textStyle: { color: "#AAB7C9" },
      formatter: (value: number) => formatValue(value, config),
      inRange: { color: [colorWithOpacity(colors[0]!, 0.12), colors[0]!, colors[1] ?? colors[0]!] },
    };
    option.series = [
      {
        name: config.y,
        type: "heatmap",
        data,
        label: config.dataLabels
          ? {
              show: true,
              color: "#FFFFFF",
              textBorderColor: "#0B1220",
              textBorderWidth: 3,
              formatter: (p: { value?: unknown }) => formatValue((p.value as number[])[2]!, config),
            }
          : { show: false },
        itemStyle: {
          borderColor: "#0D1F3C",
          borderWidth: 2,
          borderRadius: Math.min(config.radius, 6),
        },
      },
    ];
    return option;
  }

  const horizontal = config.kind === "horizontalBar";
  const stacked = config.kind === "stacked";
  const percent = stacked && config.stackPercent === true;
  const totals = categories.map((label) =>
    names.reduce((sum, name) => sum + Math.max(valueOf(label, name) ?? 0, 0), 0),
  );
  const display = (label: string, name: string, index: number): number | null => {
    const v = valueOf(label, name);
    if (v === null) return null;
    if (!percent) return v;
    return totals[index]! > 0 ? Number(((Math.max(v, 0) / totals[index]!) * 100).toFixed(2)) : 0;
  };

  const pctConfig = { ...config, prefix: "", suffix: "%", compact: false };
  // النسبة المئوية داخل صفحة RTL تنعكس ("% 100")؛ نعزلها كنص LTR.
  const fmtSeries = (value: number) => {
    const text = formatValue(value, percent ? pctConfig : config).replace(" %", "%");
    return percent ? `\u2066${text}\u2069` : text;
  };
  const axisFormatter = fmtSeries;

  option["legend"] = {
    ...(option["legend"] as object),
    show: config.legend !== "hidden" && names.length > 1,
    type: "scroll",
  };
  option["tooltip"] = {
    trigger: "axis",
    axisPointer: { type: stacked || horizontal ? "shadow" : "line" },
    valueFormatter: (value: unknown) => (typeof value === "number" ? fmtSeries(value) : "—"),
  };

  const valueAxis = {
    type: "value",
    ...(percent ? { max: 100 } : {}),
    axisLine,
    axisLabel: { ...axisLabel, formatter: axisFormatter },
    splitLine: valueSplitLine,
  };
  const categoryAxis = {
    type: "category",
    data: categories,
    ...(horizontal ? { inverse: true } : {}),
    axisLine,
    axisLabel: horizontal
      ? { ...axisLabel, width: 160, overflow: "truncate" }
      : { ...axisLabel, rotate: config.xAngle },
    splitLine: { show: false },
  };
  option["xAxis"] = horizontal ? valueAxis : categoryAxis;
  option["yAxis"] = horizontal ? categoryAxis : valueAxis;
  if (horizontal) option["grid"] = { left: 20, right: 28, top: 24, bottom: 40, containLabel: true };

  option.series = names.map((name, si) => {
    const color = colors[si % colors.length]!;
    const data = categories.map((label, ci) => display(label, name, ci));
    if (config.kind === "line" || config.kind === "area") {
      return {
        name,
        type: "line",
        data,
        smooth: config.curve === "monotone",
        symbol: "circle",
        symbolSize: 6,
        connectNulls: false,
        lineStyle: { width: 2.5, color },
        itemStyle: { color },
        ...(config.kind === "area" ? { areaStyle: { color: colorWithOpacity(color, 0.18) } } : {}),
      };
    }
    const last = si === names.length - 1;
    return {
      name,
      type: "bar",
      data,
      barMaxWidth: 36,
      ...(stacked ? { stack: "total" } : {}),
      itemStyle: {
        color,
        borderRadius: stacked
          ? last
            ? [config.radius, config.radius, 0, 0]
            : 0
          : horizontal
            ? [0, config.radius, config.radius, 0]
            : [config.radius, config.radius, 0, 0],
      },
      label: config.dataLabels
        ? {
            show: true,
            position: stacked ? "inside" : horizontal ? "right" : "top",
            color: stacked ? "#0B1220" : "inherit",
            formatter: (p: { value?: unknown }) =>
              typeof p.value === "number" ? fmtSeries(p.value) : "",
          }
        : { show: false },
    };
  });
  return option;
}

const AGG_TITLE: Record<string, string> = {
  SUM: "مجموع",
  AVG: "متوسط",
  COUNT: "عدد",
  MAX: "أعلى",
  MIN: "أدنى",
};

const NO_AXES: ChartConfig["kind"][] = ["pie", "funnel", "treemap", "radar", "scatter", "heatmap"];

/** عنوان محور القيم: «المجموع · المبيعات (ر.س)». */
export function valueAxisTitle(config: ChartConfig): string {
  if (config.kind === "histogram") return "التكرار";
  const agg = AGG_TITLE[config.agg] ?? "";
  const unit = `${config.prefix}${config.suffix}`.trim();
  const base = config.agg === "COUNT" ? agg : `${agg} · ${config.y}`;
  return unit ? `${base} (${unit})` : base;
}

/**
 * يضيف عناوين المحاور (إن فعّلها المستخدم) بعد بناء الخيار وبعد التلوين الزجاجي،
 * ويزيد هوامش الشبكة بما يكفي حتى لا تتداخل العناوين مع التسميات.
 */
export function decorateAxes<T extends Record<string, unknown>>(option: T, config: ChartConfig): T {
  if (config.axisTitles !== true || NO_AXES.includes(config.kind)) return option;
  const x = option["xAxis"] as Record<string, unknown> | undefined;
  const y = option["yAxis"] as Record<string, unknown> | undefined;
  if (!x || !y || Array.isArray(x) || Array.isArray(y)) return option;
  const horizontal = config.kind === "horizontalBar";
  const catTitle = config.kind === "histogram" ? config.y : config.x;
  const valTitle = valueAxisTitle(config);
  const nameStyle = { color: "#8FA0B8", fontSize: 11 };
  const grid = (option["grid"] as Record<string, unknown> | undefined) ?? {};
  const num = (v: unknown, d: number) => (typeof v === "number" ? v : d);
  const catAxis = horizontal ? y : x;
  const valAxis = horizontal ? x : y;
  const out: Record<string, unknown> = { ...option };
  const cat = {
    ...catAxis,
    name: catTitle,
    ...(horizontal
      ? { nameLocation: "start", nameGap: 12, nameTextStyle: { ...nameStyle, align: "right" } }
      : { nameLocation: "middle", nameGap: config.xAngle === 0 ? 30 : 52, nameTextStyle: nameStyle }),
  };
  const val = {
    ...valAxis,
    name: valTitle,
    nameTextStyle: { ...nameStyle, align: horizontal ? "center" : "left" },
    ...(horizontal
      ? { nameLocation: "middle", nameGap: 30 }
      : { nameLocation: "end", nameGap: 12 }),
  };
  out["xAxis"] = horizontal ? val : cat;
  out["yAxis"] = horizontal ? cat : val;
  out["grid"] = {
    ...grid,
    top: num(grid["top"], 24) + 20,
    bottom: num(grid["bottom"], 24) + (horizontal ? 24 : config.xAngle === 0 ? 22 : 26),
    containLabel: true,
  };
  return out as T;
}
