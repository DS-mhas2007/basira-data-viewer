import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toPng: vi.fn(),
  addPage: vi.fn(),
  addImage: vi.fn(),
  svg: vi.fn(),
  output: vi.fn(() => new Blob(["pdf"], { type: "application/pdf" })),
  getDescriptors: vi.fn((): Array<{ host: HTMLElement; option: Record<string, unknown>; width: number; height: number }> => []),
  renderSvg: vi.fn(),
}));

vi.mock("html-to-image", () => ({ toPng: mocks.toPng }));
vi.mock("jspdf", () => ({
  jsPDF: class {
    addPage = mocks.addPage;
    addImage = mocks.addImage;
    svg = mocks.svg;
    output = mocks.output;
  },
}));
vi.mock("svg2pdf.js", () => ({ svg2pdf: mocks.svg }));
vi.mock("@/components/ReportDocument", () => ({ PAGE_W: 794, PAGE_H: 1123 }));
vi.mock("@/lib/report-chart-export", () => ({
  getReportChartExportDescriptors: mocks.getDescriptors,
}));
vi.mock("@/lib/echarts-svg-export", () => ({
  renderEChartsSvg: mocks.renderSvg,
}));

import { buildReportPdf, mapChartRectToPdf } from "@/lib/pdf-report";

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect;
}

function makeReport() {
  const root = document.createElement("div");
  root.innerHTML = '<section data-pdf-page="one"></section>';
  const page = root.querySelector<HTMLElement>("[data-pdf-page]")!;
  Object.defineProperty(page, "getBoundingClientRect", { value: () => rect(100, 200, 794, 1123) });
  return { root, page };
}

describe("buildReportPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.toPng.mockResolvedValue("data:image/png;base64,ZmFrZQ==");
    mocks.svg.mockResolvedValue(undefined);
    mocks.renderSvg.mockResolvedValue('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><path d="M0 0 L10 10"/></svg>');
    mocks.getDescriptors.mockReturnValue([]);
    mocks.output.mockReturnValue(new Blob(["pdf"], { type: "application/pdf" }));
  });

  it("rejects an empty report instead of generating a blank PDF", async () => {
    const root = document.createElement("div");
    await expect(buildReportPdf(root)).rejects.toThrow("no-pages");
    expect(mocks.toPng).not.toHaveBeenCalled();
  });

  it("keeps Arabic-safe page rasterization as a fallback for every report page", async () => {
    const root = document.createElement("div");
    root.innerHTML = '<section data-pdf-page="one"></section><section data-pdf-page="two"></section>';

    const blob = await buildReportPdf(root);

    expect(mocks.toPng).toHaveBeenCalledTimes(2);
    for (const [page, options] of mocks.toPng.mock.calls) {
      expect(page).toBeInstanceOf(HTMLElement);
      expect(options).toMatchObject({
        pixelRatio: 2,
        width: 794,
        height: 1123,
        backgroundColor: "#010A19",
        cacheBust: false,
      });
    }
    expect(mocks.addPage).toHaveBeenCalledTimes(1);
    expect(mocks.addImage).toHaveBeenCalledTimes(2);
    expect(mocks.addImage).toHaveBeenNthCalledWith(
      1,
      "data:image/png;base64,ZmFrZQ==",
      "PNG",
      0,
      0,
      595.28,
      841.89,
      undefined,
      "FAST",
    );
    expect(blob.type).toBe("application/pdf");
  });

  it("overlays an ECharts SVG as vector PDF artwork at the measured page position", async () => {
    const { root, page } = makeReport();
    const host = document.createElement("div");
    host.style.visibility = "visible";
    Object.defineProperty(host, "getBoundingClientRect", { value: () => rect(150, 260, 200, 100) });
    const option = { series: [{ type: "bar" as const, data: [2, 4] }] };
    mocks.getDescriptors.mockReturnValue([{ host, option, width: 200, height: 100 }]);

    await buildReportPdf(root);

    expect(mocks.toPng).toHaveBeenCalledTimes(1);
    expect(mocks.toPng.mock.calls[0]?.[0]).toBe(page);
    expect(host.style.visibility).toBe("visible");
    expect(mocks.renderSvg).toHaveBeenCalledWith(option, { width: 200, height: 100 });
    expect(mocks.svg).toHaveBeenCalledTimes(1);
    const [svgElement, placement] = mocks.svg.mock.calls[0]!;
    expect((svgElement as Element).localName).toBe("svg");
    expect(placement).toEqual({
      x: 50 * (595.28 / 794),
      y: 60 * (841.89 / 1123),
      width: 200 * (595.28 / 794),
      height: 100 * (841.89 / 1123),
    });
    expect(mocks.addImage).toHaveBeenCalledTimes(1);
  });

  it("uses a chart-only raster fallback when SVG labels contain Arabic text", async () => {
    const { root } = makeReport();
    const host = document.createElement("div");
    Object.defineProperty(host, "getBoundingClientRect", { value: () => rect(150, 260, 200, 100) });
    mocks.getDescriptors.mockReturnValue([{
      host,
      option: { series: [] },
      width: 200,
      height: 100,
    }]);
    mocks.renderSvg.mockResolvedValue('<svg xmlns="http://www.w3.org/2000/svg"><text>مبيعات</text></svg>');
    mocks.toPng.mockImplementation(async (element: HTMLElement) =>
      element === host ? "data:image/png;base64,Y2hhcnQ=" : "data:image/png;base64,cGFnZQ==",
    );

    await buildReportPdf(root);

    expect(mocks.svg).not.toHaveBeenCalled();
    expect(mocks.toPng).toHaveBeenCalledTimes(2);
    expect(mocks.addImage).toHaveBeenCalledTimes(2);
    expect(mocks.addImage).toHaveBeenLastCalledWith(
      "data:image/png;base64,Y2hhcnQ=",
      "PNG",
      50 * (595.28 / 794),
      60 * (841.89 / 1123),
      200 * (595.28 / 794),
      100 * (841.89 / 1123),
      undefined,
      "FAST",
    );
  });

  it("falls back to a raster chart if SVG conversion fails", async () => {
    const { root } = makeReport();
    const host = document.createElement("div");
    Object.defineProperty(host, "getBoundingClientRect", { value: () => rect(150, 260, 200, 100) });
    mocks.getDescriptors.mockReturnValue([{
      host,
      option: { series: [] },
      width: 200,
      height: 100,
    }]);
    mocks.svg.mockRejectedValue(new Error("svg conversion failed"));
    mocks.toPng.mockResolvedValue("data:image/png;base64,ZmFrZQ==");

    await expect(buildReportPdf(root)).resolves.toBeInstanceOf(Blob);

    expect(mocks.svg).toHaveBeenCalledTimes(1);
    expect(mocks.toPng).toHaveBeenCalledTimes(2);
    expect(mocks.addImage).toHaveBeenCalledTimes(2);
  });

  it("maps page-relative chart rectangles into A4 points", () => {
    expect(mapChartRectToPdf(rect(100, 200, 794, 1123), rect(150, 260, 200, 100))).toEqual({
      x: 50 * (595.28 / 794),
      y: 60 * (841.89 / 1123),
      width: 200 * (595.28 / 794),
      height: 100 * (841.89 / 1123),
    });
  });

  it("accounts for CSS scaling applied to the report preview", () => {
    expect(mapChartRectToPdf(rect(100, 200, 397, 561.5), rect(125, 230, 100, 50))).toEqual({
      x: 25 * (595.28 / 397),
      y: 30 * (841.89 / 561.5),
      width: 100 * (595.28 / 397),
      height: 50 * (841.89 / 561.5),
    });
  });

  it("does not silently produce a partial document when a page capture fails", async () => {
    const root = document.createElement("div");
    root.innerHTML = '<section data-pdf-page="one"></section><section data-pdf-page="two"></section>';
    mocks.toPng.mockResolvedValueOnce("data:image/png;base64,ZmFrZQ==").mockRejectedValueOnce(new Error("capture failed"));

    await expect(buildReportPdf(root)).rejects.toThrow("capture failed");
    expect(mocks.addImage).toHaveBeenCalledTimes(1);
    expect(mocks.output).not.toHaveBeenCalled();
  });

  it("restores chart visibility even when page capture fails", async () => {
    const { root } = makeReport();
    const host = document.createElement("div");
    host.style.visibility = "visible";
    Object.defineProperty(host, "getBoundingClientRect", { value: () => rect(150, 260, 200, 100) });
    mocks.getDescriptors.mockReturnValue([{ host, option: { series: [] }, width: 200, height: 100 }]);
    mocks.toPng.mockRejectedValue(new Error("capture failed"));

    await expect(buildReportPdf(root)).rejects.toThrow("capture failed");
    expect(host.style.visibility).toBe("visible");
    expect(mocks.output).not.toHaveBeenCalled();
  });
});
