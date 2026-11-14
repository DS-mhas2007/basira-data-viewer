import { beforeEach, describe, expect, it } from "vitest";
import { getReportChartExportDescriptors, registerReportChart, unregisterReportChart } from "@/lib/report-chart-export";

describe("report chart export registry", () => {
  let root: HTMLDivElement;
  let host: HTMLDivElement;
  const option = { series: [{ type: "bar" as const, data: [1, 2] }] };

  beforeEach(() => {
    root = document.createElement("div");
    host = document.createElement("div");
    host.setAttribute("data-pdf-chart", "");
    Object.defineProperty(host, "getBoundingClientRect", {
      value: () => ({ width: 320, height: 180, top: 0, left: 0, right: 320, bottom: 180, x: 0, y: 0, toJSON() {} }),
    });
    root.append(host);
  });

  it("retains the original option object and measured dimensions", () => {
    registerReportChart(host, option);
    expect(getReportChartExportDescriptors(root)[0]).toMatchObject({ host, option, width: 320, height: 180 });
  });

  it("ignores unregistered hosts", () => {
    expect(getReportChartExportDescriptors(root)).toEqual([]);
  });

  it("ignores hosts without usable dimensions", () => {
    Object.defineProperty(host, "getBoundingClientRect", {
      value: () => ({ width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON() {} }),
    });
    registerReportChart(host, option);
    expect(getReportChartExportDescriptors(root)).toEqual([]);
  });

  it("removes registrations on cleanup", () => {
    registerReportChart(host, option);
    unregisterReportChart(host);
    expect(getReportChartExportDescriptors(root)).toEqual([]);
  });
});
