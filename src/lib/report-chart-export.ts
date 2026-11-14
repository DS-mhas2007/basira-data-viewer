import type { EChartsOption } from "echarts";

export interface ReportChartExportDescriptor {
  host: HTMLElement;
  option: EChartsOption;
  width: number;
  height: number;
}

// Preserve formatter functions without serializing options into DOM attributes.
const reportChartOptions = new WeakMap<HTMLElement, EChartsOption>();

export function registerReportChart(host: HTMLElement, option: EChartsOption): void {
  reportChartOptions.set(host, option);
}

export function unregisterReportChart(host: HTMLElement): void {
  reportChartOptions.delete(host);
}

/** Collect only explicitly opted-in chart hosts belonging to this report. */
export function getReportChartExportDescriptors(root: ParentNode): ReportChartExportDescriptor[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-chart]")).flatMap((host) => {
    const option = reportChartOptions.get(host);
    if (!option) return [];
    const rect = host.getBoundingClientRect();
    const width = rect.width || host.clientWidth;
    const height = rect.height || host.clientHeight;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [];
    return [{ host, option, width, height }];
  });
}
