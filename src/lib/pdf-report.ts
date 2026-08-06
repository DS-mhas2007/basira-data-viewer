/**
 * الوحدة 8: تحويل صفحات مستند التقرير (DOM) إلى ملف PDF محلياً بالكامل.
 * السبب في اعتماد "رسم DOM ثم تصويره": هو الطريق الوحيد الذي يضمن تشكيل الحروف
 * العربية واتجاه RTL بشكل صحيح داخل PDF (jsPDF لا يدعم تشكيل العربية نصياً).
 */
import { getFontEmbedCSS, toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { PAGE_H, PAGE_W } from "@/components/ReportDocument";

const A4_W = 595.28;
const A4_H = 841.89;

export async function exportReportPdf(root: HTMLElement, fileName: string): Promise<void> {
  const pages = Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-page]"));
  if (pages.length === 0) throw new Error("no-pages");

  // تضمين الخطوط مرة واحدة لتفادي إعادة تحميلها لكل صفحة.
  let fontEmbedCSS = "";
  try {
    fontEmbedCSS = await getFontEmbedCSS(pages[0]!);
  } catch {
    /* الخطوط ستُقرأ من الصفحة مباشرة إن تعذّر التضمين */
  }

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

  pdf.save(fileName);
}
