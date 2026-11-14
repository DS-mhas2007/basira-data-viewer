import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  init: vi.fn(),
  setOption: vi.fn(),
  renderToSVGString: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock("echarts", () => ({
  init: mocks.init,
}));

import { renderEChartsSvg } from "@/lib/echarts-svg-export";

describe("renderEChartsSvg", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.init.mockReturnValue({
      setOption: mocks.setOption,
      renderToSVGString: mocks.renderToSVGString,
      dispose: mocks.dispose,
    });
    mocks.renderToSVGString.mockReturnValue('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  });

  it("renders with the ECharts SVG SSR renderer and disables animation", async () => {
    const option = { series: [{ type: "bar" as const, data: [2, 4] }] };

    const svg = await renderEChartsSvg(option, { width: 640, height: 360 });

    expect(mocks.init).toHaveBeenCalledWith(null, undefined, {
      renderer: "svg",
      ssr: true,
      width: 640,
      height: 360,
    });
    expect(mocks.setOption).toHaveBeenCalledWith(
      { ...option, animation: false },
      { notMerge: true },
    );
    expect(svg).toContain("<svg");
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("rejects invalid dimensions before loading ECharts", async () => {
    await expect(renderEChartsSvg({}, { width: 0, height: 360 })).rejects.toThrow("invalid-chart-size");
    expect(mocks.init).not.toHaveBeenCalled();
  });

  it("rejects malformed SVG and still disposes the chart", async () => {
    mocks.renderToSVGString.mockReturnValue("<div>not svg</div>");

    await expect(renderEChartsSvg({}, { width: 100, height: 80 })).rejects.toThrow("invalid-chart-svg");
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });

  it("disposes the chart when rendering throws", async () => {
    mocks.renderToSVGString.mockImplementation(() => {
      throw new Error("renderer failed");
    });

    await expect(renderEChartsSvg({}, { width: 100, height: 80 })).rejects.toThrow("renderer failed");
    expect(mocks.dispose).toHaveBeenCalledOnce();
  });
});
