/**
 * الوحدة 8: تصدير التقرير بصيغة PDF هجينة.
 * الصفحة العربية والجداول تُلتقط كصورة للحفاظ على تشكيل RTL؛ الرسوم تُعاد
 * كـ SVG vector متى كان تحويل النص آمناً، وإلا تُلتقط كصورة مستقلة.
 */
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { PAGE_H, PAGE_W } from "@/components/ReportDocument";
import { getReportChartExportDescriptors } from "@/lib/report-chart-export";
import { renderEChartsSvg } from "@/lib/echarts-svg-export";

const A4_W = 595.28;
const A4_H = 841.89;
const ARABIC_TEXT = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/;

export interface PdfChartPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Convert a chart's page-relative CSS pixels to A4 PDF points. */
export function mapChartRectToPdf(
  pageRect: Pick<DOMRect, "left" | "top" | "width" | "height">,
  chartRect: Pick<DOMRect, "left" | "top" | "width" | "height">,
): PdfChartPlacement {
  // Use the rendered page rectangle so CSS scaling in the report preview is respected.
  const scaleX = A4_W / (pageRect.width || PAGE_W);
  const scaleY = A4_H / (pageRect.height || PAGE_H);
  return {
    x: (chartRect.left - pageRect.left) * scaleX,
    y: (chartRect.top - pageRect.top) * scaleY,
    width: chartRect.width * scaleX,
    height: chartRect.height * scaleY,
  };
}

interface SvgCapablePdf extends jsPDF {
  svg(element: Element, placement: PdfChartPlacement): Promise<jsPDF>;
}

function parseSvgElement(svg: string): SVGElement {
  const parsed = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (parsed.querySelector("parsererror") || parsed.documentElement.localName.toLowerCase() !== "svg") {
    throw new Error("invalid-chart-svg-document");
  }
  return document.importNode(parsed.documentElement, true) as unknown as SVGElement;
}

async function addChartAsRaster(
  pdf: jsPDF,
  host: HTMLElement,
  placement: PdfChartPlacement,
  fontEmbedCSS: string,
): Promise<void> {
  try {
    const dataUrl = await toPng(host, {
      pixelRatio: 2,
      width: host.getBoundingClientRect().width || host.clientWidth,
      height: host.getBoundingClientRect().height || host.clientHeight,
      backgroundColor: "#08172B",
      cacheBust: false,
      fontEmbedCSS,
    });
    pdf.addImage(dataUrl, "PNG", placement.x, placement.y, placement.width, placement.height, undefined, "FAST");
  } catch {
    // A chart fallback must not invalidate the otherwise complete report.
  }
}

async function addChartAsVector(
  pdf: jsPDF,
  host: HTMLElement,
  option: Parameters<typeof renderEChartsSvg>[0],
  placement: PdfChartPlacement,
  width: number,
  height: number,
  fontEmbedCSS: string,
): Promise<void> {
  try {
    const svg = await renderEChartsSvg(option, { width, height });
    // svg2pdf.js/jsPDF's standard fonts cannot shape Arabic text reliably.
    // Keep those charts on the browser raster path to preserve Arabic labels.
    if (ARABIC_TEXT.test(svg)) throw new Error("arabic-chart-labels-use-raster");
    const element = parseSvgElement(svg);
    await import("svg2pdf.js");
    await (pdf as SvgCapablePdf).svg(element, placement);
  } catch {
    await addChartAsRaster(pdf, host, placement, fontEmbedCSS);
  }
}

/** يبني ملف PDF من صفحات المستند ويعيده كـ Blob للمعاينة أو التنزيل. */
export async function buildReportPdf(root: HTMLElement): Promise<Blob> {
  const pages = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-page]"));
  if (pages.length === 0) throw new Error("no-pages");

  const fontEmbedCSS = await embedFontsCss();
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const pageRect = page.getBoundingClientRect();
    const charts = getReportChartExportDescriptors(page).map((chart) => ({
      ...chart,
      placement: mapChartRectToPdf(pageRect, chart.host.getBoundingClientRect()),
      previousVisibility: chart.host.style.visibility,
    }));

    // Capture the Arabic page and tables without duplicating the chart artwork.
    try {
      for (const chart of charts) chart.host.style.visibility = "hidden";
      const dataUrl = await toPng(page, {
        pixelRatio: 2,
        width: PAGE_W,
        height: PAGE_H,
        backgroundColor: "#010A19",
        cacheBust: false,
        fontEmbedCSS,
      });
      if (i > 0) pdf.addPage();
      pdf.addImage(dataUrl, "PNG", 0, 0, A4_W, A4_H, undefined, "FAST");
    } finally {
      for (const chart of charts) chart.host.style.visibility = chart.previousVisibility;
    }

    for (const chart of charts) {
      await addChartAsVector(
        pdf,
        chart.host,
        chart.option,
        chart.placement,
        chart.width,
        chart.height,
        fontEmbedCSS,
      );
    }
  }

  return pdf.output("blob");
}

/** ينزّل Blob جاهزاً باسم الملف المطلوب. */
export function downloadPdfBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function exportReportPdf(root: HTMLElement, fileName: string): Promise<void> {
  downloadPdfBlob(await buildReportPdf(root), fileName);
}

let fontCssCache: string | null = null;

/**
 * Builds CSS with embedded Google font assets. This keeps the raster page capture
 * independent from cross-origin stylesheet access and preserves Arabic shaping.
 */
export async function embedFontsCss(): Promise<string> {
  if (fontCssCache !== null) return fontCssCache;
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).filter(
    (link) => link.href.includes("fonts.googleapis.com"),
  );
  const parts: string[] = [];
  for (const link of links) {
    try {
      const css = await (await fetch(link.href)).text();
      const urls = Array.from(new Set(css.match(/https:\/\/[^)"']+\.(?:woff2|woff|ttf)/g) ?? []));
      const pairs = await Promise.all(
        urls.map(async (url) => {
          const buffer = await (await fetch(url)).arrayBuffer();
          let binary = "";
          const bytes = new Uint8Array(buffer);
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
          const mime = url.endsWith(".woff2") ? "font/woff2" : url.endsWith(".woff") ? "font/woff" : "font/ttf";
          return [url, `data:${mime};base64,${btoa(binary)}`] as const;
        }),
      );
      let embeddedCss = css;
      for (const [url, data] of pairs) embeddedCss = embeddedCss.split(url).join(data);
      parts.push(embeddedCss);
    } catch {
      /* Use the browser's local fallback font when remote font embedding is unavailable. */
    }
  }
  fontCssCache = parts.join("\n");
  return fontCssCache;
}
