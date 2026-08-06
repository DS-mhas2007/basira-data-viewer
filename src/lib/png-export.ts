/**
 * تصدير أقسام التقرير كصور PNG مستقلة (لكل صفحة/قسم صورة) — محلياً بالكامل.
 */
import { toPng } from "html-to-image";
import { PAGE_H, PAGE_W } from "@/components/ReportDocument";
import { embedFontsCss } from "@/lib/pdf-report";

export interface ReportSection {
  index: number;
  title: string;
  el: HTMLElement;
}

/** يقرأ أقسام التقرير المرسومة داخل حاوية المعاينة. */
export function readReportSections(root: HTMLElement): ReportSection[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-pdf-page]")).map((el, i) => ({
    index: i + 1,
    title: el.dataset["sectionTitle"] || `صفحة ${i + 1}`,
    el,
  }));
}

/** يحوّل عنصر قسم إلى صورة PNG بجودة مضاعفة مع تضمين الخطوط العربية. */
export async function sectionToPng(el: HTMLElement): Promise<string> {
  const fontEmbedCSS = await embedFontsCss();
  return toPng(el, {
    pixelRatio: 2,
    width: PAGE_W,
    height: PAGE_H,
    backgroundColor: "#010A19",
    cacheBust: false,
    fontEmbedCSS,
  });
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, "").trim().replace(/\s+/g, "-");
}

export function pngFileName(base: string, section: ReportSection): string {
  return `${safeName(base)}-${String(section.index).padStart(2, "0")}-${safeName(section.title)}.png`;
}

function downloadDataUrl(dataUrl: string, fileName: string): void {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** ينزّل قسماً واحداً كصورة PNG. */
export async function downloadSectionPng(section: ReportSection, base: string): Promise<void> {
  downloadDataUrl(await sectionToPng(section.el), pngFileName(base, section));
}

/** ينزّل كل الأقسام كصور PNG متتابعة (مع مهلة قصيرة حتى لا يحجب المتصفح التنزيلات). */
export async function downloadAllSectionPngs(sections: ReportSection[], base: string): Promise<void> {
  for (const section of sections) {
    await downloadSectionPng(section, base);
    await new Promise((r) => setTimeout(r, 350));
  }
}