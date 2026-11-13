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
  };
});

vi.mock("echarts", () => ({ init: mocks.init }));

import { EChartsView } from "@/components/EChartsView";

describe("EChartsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.init.mockImplementation(() => mocks.chart);
  });

  afterEach(() => {
    cleanup();
  });

  it("initializes the chart and applies the supplied option", async () => {
    const option = {
      xAxis: { type: "category" as const, data: ["A", "B"] },
      series: [{ type: "bar" as const, data: [2, 3] }],
    };

    render(<EChartsView option={option} label="مبيعات شهرية" />);

    await waitFor(() => expect(mocks.init).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(mocks.chart.setOption).toHaveBeenCalledWith(option, {
        notMerge: true,
        lazyUpdate: true,
      }),
    );
    expect(screen.getByRole("img", { name: "مبيعات شهرية" })).toBeInTheDocument();
  });

  it("disposes the chart when the component unmounts", async () => {
    const { unmount } = render(<EChartsView option={{ series: [] }} />);

    await waitFor(() => expect(mocks.chart.setOption).toHaveBeenCalled());
    unmount();

    expect(mocks.chart.dispose).toHaveBeenCalledTimes(1);
  });

  it("shows an accessible fallback when chart initialization fails", async () => {
    mocks.init.mockImplementation(() => {
      throw new Error("canvas initialization failed");
    });

    render(<EChartsView option={{ series: [] }} />);

    expect(
      await screen.findByRole("status"),
    ).toHaveTextContent("تعذّر تحميل الرسم البياني");
  });
});
