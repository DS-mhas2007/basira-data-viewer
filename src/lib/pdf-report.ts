/**
 * الوحدة 8: تحويل صفحات مستند التقرير (DOM) إلى ملف PDF محلياً بالكامل.
 * السبب في اعتماد "رسم DOM ثم تصويره": هو الطريق الوحيد الذي يضمن تشكيل الحروف
 * العربية واتجاه RTL بشكل صحيح داخل PDF (jsPDF لا يدعم تشكيل العربية نصياً).
 */
import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { PAGE_H, PAGE_W } from "@/components/ReportDocument";

const A4_W = 595.28;
const A4_H = 841.89;

/** يبني ملف PDF من صفحات المستند ويعيده كـ Blob (للمعاينة داخل المتصفح قبل التنزيل). */
export async function buildReportPdf(root: HTMLElement): Promise<Blob> {
  const pages = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-page]"));
  if (pages.length === 0) throw new Error("no-pages");

  const fontEmbedCSS = await embedFontsCss();

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });

  for (let i = 0; i < pages.length; i++) {
    const dataUrl = await toPng(pages[i]!, {
      pixelRatio: 2,
      width: PAGE_W,
      height: PAGE_H,
      backgroundColor: "#010A19",
      cacheBust: false,
      fontEmbedCSS,
    });
    if (i > 0) pdf.addPage();
    pdf.addImage(dataUrl, "PNG", 0, 0, A4_W, A4_H, undefined, "FAST");
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
 * يبني CSS خطوط مضمّنة (base64) من وسوم <link> الخاصة بالخطوط.
 * ضروري لأن قراءة cssRules من ورقة أنماط خارجية ممنوعة بسبب CORS،
 * وبدون التضمين قد يظهر النص العربي بخط بديل مختلف داخل الـ PDF.
 */
async function embedFontsCss(): Promise<string> {
  if (fontCssCache !== null) return fontCssCache;
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')).filter(
    (l) => l.href.includes("fonts.googleapis.com"),
  );
  const parts: string[] = [];
  for (const link of links) {
    try {
      const css = await (await fetch(link.href)).text();
      const urls = Array.from(new Set(css.match(/https:\/\/[^)"']+\.(?:woff2|woff|ttf)/g) ?? []));
      const pairs = await Promise.all(
        urls.map(async (u) => {
          const buf = await (await fetch(u)).arrayBuffer();
          let bin = "";
          const bytes = new Uint8Array(buf);
          for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
          const mime = u.endsWith(".woff2") ? "font/woff2" : u.endsWith(".woff") ? "font/woff" : "font/ttf";
          return [u, `data:${mime};base64,${btoa(bin)}`] as const;
        }),
      );
      let out = css;
      for (const [u, data] of pairs) out = out.split(u).join(data);
      parts.push(out);
    } catch {
      /* تجاهل: سيُستخدم خط النظام البديل */
    }
  }
  fontCssCache = parts.join("\n");
  return fontCssCache;
}
