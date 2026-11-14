import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  toPng: vi.fn(),
  addPage: vi.fn(),
  addImage: vi.fn(),
  output: vi.fn(() => new Blob(["pdf"], { type: "application/pdf" })),
}));

vi.mock("html-to-image", () => ({ toPng: mocks.toPng }));
vi.mock("jspdf", () => ({
  jsPDF: class {
    addPage = mocks.addPage;
    addImage = mocks.addImage;
    output = mocks.output;
  },
}));
vi.mock("@/components/ReportDocument", () => ({ PAGE_W: 794, PAGE_H: 1123 }));

import { buildReportPdf } from "@/lib/pdf-report";

describe("buildReportPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.toPng.mockResolvedValue("data:image/png;base64,ZmFrZQ==");
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

  it("does not silently produce a partial document when a page capture fails", async () => {
    const root = document.createElement("div");
    root.innerHTML = '<section data-pdf-page="one"></section><section data-pdf-page="two"></section>';
    mocks.toPng.mockResolvedValueOnce("data:image/png;base64,ZmFrZQ==").mockRejectedValueOnce(new Error("capture failed"));

    await expect(buildReportPdf(root)).rejects.toThrow("capture failed");
    expect(mocks.addImage).toHaveBeenCalledTimes(1);
    expect(mocks.output).not.toHaveBeenCalled();
  });
});
