import type { ECharts, EChartsOption } from "echarts";

export interface EChartsSvgExportSize {
  width: number;
  height: number;
}

/**
 * Render a chart option to a standalone SVG string using ECharts' zero-DOM
 * server-side SVG renderer. The caller owns PDF placement and fallback.
 */
export async function renderEChartsSvg(
  option: EChartsOption,
  { width, height }: EChartsSvgExportSize,
): Promise<string> {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("invalid-chart-size");
  }

  const { init } = await import("echarts");
  const chart = init(null, undefined, {
    renderer: "svg",
    ssr: true,
    width,
    height,
  }) as ECharts & { renderToSVGString: () => string };

  try {
    chart.setOption({ ...option, animation: false }, { notMerge: true });
    const svg = chart.renderToSVGString();
    if (!svg || !svg.toLowerCase().includes("<svg")) throw new Error("invalid-chart-svg");
    return svg;
  } finally {
    chart.dispose();
  }
}
