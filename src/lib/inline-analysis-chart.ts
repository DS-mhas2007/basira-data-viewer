export interface InlineChartSpec {
  type: string;
  x?: string | null;
  y?: string[];
  series?: string | null;
}

/** Build a conservative ECharts option only when SQL rows support a meaningful chart. */
export function buildInlineAnalysisChart(chart: InlineChartSpec | null | undefined, rows: Record<string, unknown>[]): Record<string, unknown> | null {
  if (!chart || rows.length < 2 || !["bar", "line", "area", "scatter", "histogram", "pie"].includes(chart.type)) return null;
  const xKey = chart.x?.trim();
  const yKeys = (chart.y ?? []).filter((key) => typeof key === "string" && key.trim());
  if (!xKey || yKeys.length === 0 || !rows.some((row) => Object.hasOwn(row, xKey))) return null;
  if (yKeys.some((key) => !rows.some((row) => Object.hasOwn(row, key)))) return null;
  const numeric = (value: unknown): number | null => {
    if (value === null || value === undefined || value === "" || typeof value === "boolean") return null;
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  if (chart.type === "scatter") {
    const yKey = yKeys[0]!;
    const points = rows.map((row) => [numeric(row[xKey]), numeric(row[yKey])] as const)
      .filter((point): point is readonly [number, number] => point[0] !== null && point[1] !== null);
    if (points.length < 2) return null;
    return { animation: true, grid: { left: 16, right: 18, top: 20, bottom: 36, containLabel: true }, tooltip: { trigger: "item" }, xAxis: { type: "value", name: xKey }, yAxis: { type: "value", name: yKey }, series: [{ name: yKey, type: "scatter", data: points, symbolSize: 9, itemStyle: { color: "#60F5D2" } }] };
  }
  const labels = rows.map((row) => String(row[xKey] ?? "—"));
  if (chart.type === "pie") {
    const yKey = yKeys[0]!;
    const slices = rows.map((row) => ({ name: String(row[xKey] ?? "—"), value: numeric(row[yKey]) }))
      .filter((item): item is { name: string; value: number } => item.value !== null && item.value >= 0);
    if (slices.length < 2) return null;
    return { animation: true, tooltip: { trigger: "item" }, legend: { bottom: 0, textStyle: { color: "#AAB7C9" } }, series: [{ name: yKey, type: "pie", radius: ["42%", "72%"], data: slices, label: { show: true, formatter: "{b}: {d}%" }, itemStyle: { borderColor: "#0D1F3C", borderWidth: 2 } }] };
  }
  const series = yKeys.map((key, index) => ({ name: key, type: chart.type === "line" || chart.type === "area" ? "line" : "bar", data: rows.map((row) => numeric(row[key])), smooth: chart.type === "line" || chart.type === "area", areaStyle: chart.type === "area" ? { opacity: 0.18 } : undefined, symbol: chart.type === "line" || chart.type === "area" ? "circle" : undefined, symbolSize: chart.type === "line" || chart.type === "area" ? 7 : undefined, itemStyle: { color: index === 0 ? "#60F5D2" : "#D6B2FC", borderRadius: chart.type === "line" || chart.type === "area" ? 0 : [5, 5, 0, 0] }, connectNulls: false }));
  if (series.every((item) => item.data.filter((value) => value !== null).length < 2)) return null;
  return { animation: true, color: ["#60F5D2", "#D6B2FC", "#7DD3FC", "#FDE68A"], grid: { left: 16, right: 18, top: 24, bottom: 56, containLabel: true }, tooltip: { trigger: "axis" }, legend: { show: yKeys.length > 1, textStyle: { color: "#AAB7C9" } }, xAxis: { type: "category", data: labels, axisLabel: { color: "#AAB7C9", hideOverlap: true, rotate: labels.length > 7 ? 30 : 0 } }, yAxis: { type: "value", axisLabel: { color: "#AAB7C9" }, splitLine: { lineStyle: { color: "#34445E", type: "dashed" } } }, series };
}