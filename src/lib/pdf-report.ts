/**
 * الوحدة 8: تصدير التقرير بصيغة PDF هجينة.
 * الصفحة العربية والجداول تُلتقط كصورة للحفاظ على تشكيل RTL؛ الرسوم تُعاد
 * كـ SVG vector متى كان تحويل النص آمناً، وإلا تُلتقط كصورة مستقلة.
 */
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { PAGE_H, PAGE_W } from "@/lib/report-page";
import { getReportChartExportDescriptors } from "@/lib/report-chart-export";
import { renderEChartsSvg } from "@/lib/echarts-svg-export";
import {
  addInternalLinks,
  addInvisibleText,
  disableJsPdfTextShaping,
  collectLinkBoxes,
  collectTextLines,
  registerTextFont,
} from "@/lib/pdf-text-layer";

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
      backgroundColor: getComputedStyle(host.closest("[data-pdf-page]") ?? host).backgroundColor || "#F1EDE2",
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
    // Attach the SVG while svg2pdf reads computed styles and viewport metrics.
    const mount = document.createElement("div");
    mount.style.cssText = "position:fixed;left:-10000px;top:0;pointer-events:none;";
    mount.appendChild(element);
    document.body.appendChild(mount);
    try {
      const { svg2pdf } = await import("svg2pdf.js");
      await svg2pdf(element, pdf, placement);
    } finally {
      mount.remove();
    }
  } catch (error) {
    console.warn(
      "[pdf] SVG chart conversion fell back to raster:",
      error instanceof Error ? error.message : String(error),
    );
    await addChartAsRaster(pdf, host, placement, fontEmbedCSS);
  }
}

/** يبني ملف PDF من صفحات المستند ويعيده كـ Blob للمعاينة أو التنزيل. */
export interface PdfMeta {
  title?: string;
  subject?: string;
  keywords?: string[];
}

export async function buildReportPdf(root: HTMLElement, meta: PdfMeta = {}): Promise<Blob> {
  const pages = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-page]"));
  if (pages.length === 0) throw new Error("no-pages");

  // Wait for the chosen report typeface before rasterizing Arabic pages.
  // The embedded CSS below then keeps the exported PDF independent of font CDNs.
  if (typeof document === "undefined" || !document.fonts?.load) {
    throw new Error("pdf-font-loading-api-unavailable");
  }
  const [regularFaces, boldFaces] = await Promise.all([
    document.fonts.load('400 14px "Changa"', "العربية MIZYA"),
    document.fonts.load('700 24px "Changa"', "العربية MIZYA"),
  ]);
  await document.fonts.ready;
  if (
    regularFaces.length === 0 ||
    boldFaces.length === 0 ||
    [...regularFaces, ...boldFaces].some((face) => face.status !== "loaded")
  ) {
    throw new Error("changa-font-not-loaded");
  }
  const fontEmbedCSS = await embedFontsCss();
  disableJsPdfTextShaping();
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
  pdf.setProperties?.({
    title: meta.title ?? "تقرير MIZYAi",
    subject: meta.subject ?? "تقرير تحليل بيانات — MIZYAi",
    author: "MIZYAi",
    creator: "MIZYAi",
    keywords: (meta.keywords ?? ["MIZYAi", "تقرير", "تحليل بيانات"]).join(", "),
  });
  const textLayer = await registerTextFont(pdf);
  const bookmarks: { title: string; page: number }[] = [];

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
      const computedPageBackground = getComputedStyle(page).backgroundColor;
      const pageBackground =
        computedPageBackground === "rgba(0, 0, 0, 0)" ? "#F1EDE2" : computedPageBackground;
      const dataUrl = await toPng(page, {
        pixelRatio: 2,
        width: PAGE_W,
        height: PAGE_H,
        backgroundColor: pageBackground,
        cacheBust: false,
        fontEmbedCSS,
      });
      if (i > 0) pdf.addPage();
      pdf.addImage(dataUrl, "PNG", 0, 0, A4_W, A4_H, undefined, "FAST");
      const sx = A4_W / (pageRect.width || PAGE_W);
      const sy = A4_H / (pageRect.height || PAGE_H);
      if (textLayer) {
        // طبقة نص غير مرئية (بحث/نسخ/قراءة شاشة) — الرسوم الموجّهة تُستثنى لأنها تكتب نصها بنفسها.
        addInvisibleText(pdf, collectTextLines(page, charts.map((c) => c.host)), sx, sy);
      }
      addInternalLinks(pdf, collectLinkBoxes(page), sx, sy);
      const label = page.dataset["tocLabel"] || page.dataset["sectionTitle"];
      if (label) bookmarks.push({ title: label, page: i + 1 });
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

  try {
    for (const b of bookmarks) pdf.outline?.add(null, b.title, { pageNumber: b.page });
  } catch {
    /* الإشارات المرجعية تحسين اختياري */
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
  if (fontCssCache !== null && fontCssCache.length > 0) return fontCssCache;

  // The report typeface is self-hosted. This keeps PDF rendering deterministic,
  // avoids cross-origin font fetch failures, and embeds the font into page captures.
  const link = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).find(
    (candidate) => new URL(candidate.href).pathname.endsWith("/fonts/changa.css"),
  );
  if (!link) throw new Error("changa-stylesheet-link-missing");

  const response = await fetch(link.href);
  if (!response.ok) throw new Error(`font stylesheet HTTP ${response.status}`);
  const css = await response.text();
  const parts: string[] = [];
      const sources = Array.from(
        new Set(
          Array.from(css.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g), (match) => match[2]!.trim())
            .filter((url) => url && !url.startsWith("data:")),
        ),
      );
      const pairs = await Promise.all(
        sources.map(async (source) => {
          try {
            const url = new URL(source, link.href).href;
            const fontResponse = await fetch(url);
            if (!fontResponse.ok) return null;
            const buffer = await fontResponse.arrayBuffer();
            let binary = "";
            const bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
            const pathname = new URL(url).pathname.toLowerCase();
            const mime = pathname.endsWith(".woff2")
              ? "font/woff2"
              : pathname.endsWith(".woff")
                ? "font/woff"
                : pathname.endsWith(".ttf")
                  ? "font/ttf"
                  : "application/octet-stream";
            return [source, `data:${mime};base64,${btoa(binary)}`] as const;
          } catch {
            return null;
          }
        }),
      );

      let embeddedCss = css;
      for (const pair of pairs) {
        if (pair) embeddedCss = embeddedCss.split(pair[0]).join(pair[1]);
      }
  if (!embeddedCss.includes("data:font/ttf;base64,")) {
    throw new Error("changa-font-asset-could-not-be-embedded");
  }
  parts.push(embeddedCss);

  const result = parts.join("\n");
  if (result.length === 0) throw new Error("changa-font-css-empty");
  fontCssCache = result;
  return result;
}
