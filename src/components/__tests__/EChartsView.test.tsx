import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const chart = {
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    chart,
    init: vi.fn(() => chart),
    registerReportChart: vi.fn(),
    unregisterReportChart: vi.fn(),
  };
});

vi.mock("echarts", () => ({ init: mocks.init }));
vi.mock("@/lib/report-chart-export", () => ({
  registerReportChart: mocks.registerReportChart,
  unregisterReportChart: mocks.unregisterReportChart,
}));

import { EChartsView } from "@/components/EChartsView";

describe("EChartsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.init.mockImplementation(() => mocks.chart);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("initializes the chart and applies the supplied option", async () => {
    const option = {
      xAxis: { type: "category" as const, data: ["A", "B"] },
      series: [{ type: "bar" as const, data: [2, 3] }],
    };

    render(<EChartsView option={option} label="مبيعات شهرية" />);

    expect(screen.getByRole("img", { name: "مبيعات شهرية" })).toHaveAttribute("aria-busy", "true");
    await waitFor(() => expect(mocks.init).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mocks.chart.setOption).toHaveBeenCalledWith(option, {
        notMerge: true,
        lazyUpdate: true,
      }),
    );
    expect(screen.getByRole("img", { name: "مبيعات شهرية" })).toHaveAttribute("aria-busy", "false");
  });

  it("registers the original option for PDF export and unregisters it on unmount", async () => {
    const option = {
      xAxis: { type: "category" as const, data: ["A", "B"] },
      series: [{ type: "bar" as const, data: [2, 3] }],
    };
    const { container, unmount } = render(<EChartsView option={option} pdfExport />);
    const host = container.firstChild;

    await waitFor(() => {
      expect(mocks.registerReportChart).toHaveBeenCalledWith(host, option);
    });

    unmount();
    expect(mocks.unregisterReportChart).toHaveBeenCalledWith(host);
  });

  it("updates the existing chart when the option changes without reinitializing", async () => {
    const firstOption = { series: [{ type: "bar" as const, data: [1] }] };
    const nextOption = { series: [{ type: "line" as const, data: [4, 5] }] };
    const { rerender } = render(<EChartsView option={firstOption} />);

    await waitFor(() => expect(mocks.chart.setOption).toHaveBeenCalledTimes(1));
    rerender(<EChartsView option={nextOption} />);

    await waitFor(() => expect(mocks.chart.setOption).toHaveBeenCalledTimes(2));
    expect(mocks.chart.setOption).toHaveBeenLastCalledWith(nextOption, {
      notMerge: true,
      lazyUpdate: true,
    });
    expect(mocks.init).toHaveBeenCalledTimes(1);
  });

  it("resizes through ResizeObserver and disconnects it on unmount", async () => {
    let onResize: ResizeObserverCallback | undefined;
    const disconnect = vi.fn();
    const observe = vi.fn();
    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        onResize = callback;
      }
      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", MockResizeObserver);

    const { container, unmount } = render(<EChartsView option={{ series: [] }} />);
    await waitFor(() => expect(mocks.init).toHaveBeenCalledTimes(1));

    onResize?.([], {} as ResizeObserver);
    expect(mocks.chart.resize).toHaveBeenCalledTimes(1);
    expect(observe).toHaveBeenCalledWith(container.firstChild);

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);

    // A queued observer callback after unmount must not touch the disposed chart.
    onResize?.([], {} as ResizeObserver);
    expect(mocks.chart.resize).toHaveBeenCalledTimes(1);
  });

  it("uses the window resize fallback when ResizeObserver is unavailable", async () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");

    const { unmount } = render(<EChartsView option={{ series: [] }} />);
    await waitFor(() => expect(mocks.init).toHaveBeenCalledTimes(1));

    const resizeRegistration = add.mock.calls.find(([event]) => event === "resize");
    expect(resizeRegistration).toBeDefined();
    const resizeHandler = resizeRegistration?.[1] as EventListener;
    resizeHandler(new Event("resize"));
    expect(mocks.chart.resize).toHaveBeenCalledTimes(1);

    unmount();
    expect(remove).toHaveBeenCalledWith("resize", resizeHandler);
  });

  it("does not initialize the chart if unmounted before the lazy import resolves", async () => {
    const { unmount } = render(<EChartsView option={{ series: [] }} />);

    unmount();
    await Promise.resolve();
    await Promise.resolve();

    expect(mocks.init).not.toHaveBeenCalled();
    expect(mocks.chart.setOption).not.toHaveBeenCalled();
  });

  it("disposes the chart when the component unmounts", async () => {
    const { unmount } = render(<EChartsView option={{ series: [] }} />);

    await waitFor(() => expect(mocks.chart.setOption).toHaveBeenCalled());
    unmount();

    expect(mocks.chart.dispose).toHaveBeenCalledTimes(1);
  });

  it("shows an accessible fallback and disposes the chart when applying an option fails", async () => {
    mocks.chart.setOption.mockImplementationOnce(() => {
      throw new Error("invalid chart option");
    });

    render(<EChartsView option={{ series: [] }} />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "تعذّر تهيئة الرسم البياني أو عرضه",
    );
    expect(mocks.chart.dispose).toHaveBeenCalledTimes(1);
  });

  it("disposes a chart only once when applying an option fails", async () => {
    mocks.chart.setOption.mockImplementationOnce(() => {
      throw new Error("invalid chart option");
    });

    const { unmount } = render(<EChartsView option={{ series: [] }} />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "تعذّر تهيئة الرسم البياني أو عرضه",
    );
    expect(mocks.chart.dispose).toHaveBeenCalledTimes(1);

    unmount();
    expect(mocks.chart.dispose).toHaveBeenCalledTimes(1);
  });

  it("ignores queued resize callbacks after option failure disposes the chart", async () => {
    let onResize: ResizeObserverCallback | undefined;
    const disconnect = vi.fn();
    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        onResize = callback;
      }
      observe = vi.fn();
      disconnect = disconnect;
      unobserve = vi.fn();
    }
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    mocks.chart.setOption.mockImplementationOnce(() => {
      throw new Error("invalid chart option");
    });

    const { unmount } = render(<EChartsView option={{ series: [] }} />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "تعذّر تهيئة الرسم البياني أو عرضه",
    );
    expect(disconnect).toHaveBeenCalledTimes(1);
    onResize?.([], {} as ResizeObserver);
    expect(mocks.chart.resize).not.toHaveBeenCalled();

    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(mocks.chart.dispose).toHaveBeenCalledTimes(1);
  });

  it("shows an accessible fallback when chart initialization fails", async () => {
    mocks.init.mockImplementation(() => {
      throw new Error("canvas initialization failed");
    });

    render(<EChartsView option={{ series: [] }} />);

    expect(await screen.findByRole("status")).toHaveTextContent(
      "تعذّر تهيئة الرسم البياني أو عرضه",
    );
  });
});
