/**
 * طبقة نص غير مرئية فوق صفحات الـPDF المصوَّرة: تجعل التقرير قابلاً للبحث والتحديد والنسخ
 * (وقارئات الشاشة) دون المساس بجودة العربي، لأن الشكل المرئي يبقى الصورة عالية الدقة.
 * النص يُكتب بترتيبه المنطقي (وليس البصري)، فيعمل البحث العربي والنسخ كما يجب.
 */
import { jsPDF } from "jspdf";

export interface TextLine {
  text: string;
  /** إحداثيات نسبية لزاوية الصفحة بوحدة CSS px. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LinkBox {
  x: number;
  y: number;
  w: number;
  h: number;
  /** رقم الصفحة الهدف (يبدأ من 1). */
  page: number;
}

type RectLike = Pick<DOMRect, "left" | "top" | "width" | "height">;

const WS_ONLY = /^[\s\u200b-\u200f\u202a-\u202e\u2066-\u2069]*$/;

function isHidden(el: Element | null, skip: HTMLElement[]): boolean {
  for (let cur: Element | null = el; cur; cur = cur.parentElement) {
    if (skip.includes(cur as HTMLElement)) return true;
    const tag = cur.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "svg" || tag === "CANVAS") return true;
    const st = getComputedStyle(cur);
    if (st.display === "none" || st.visibility === "hidden") return true;
    if (cur.hasAttribute("data-pdf-page")) break;
  }
  return false;
}

/** يجمع أسطر النص المرئية داخل صفحة، بالترتيب المنطقي للـDOM. */
export function collectTextLines(page: HTMLElement, skipHosts: HTMLElement[] = []): TextLine[] {
  const pageRect = page.getBoundingClientRect();
  const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  const out: TextLine[] = [];
  const range = document.createRange();

  const push = (text: string, r: RectLike) => {
    const t = text
      .replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!t || r.width <= 0 || r.height <= 0) return;
    const line: TextLine = {
      text: t,
      x: r.left - pageRect.left,
      y: r.top - pageRect.top,
      w: r.width,
      h: r.height,
    };
    const prev = out[out.length - 1];
    // دمج مقاطع inline المتجاورة على نفس السطر لتبقى الجملة قابلة للبحث كاملةً.
    if (
      prev &&
      Math.abs(prev.y + prev.h / 2 - (line.y + line.h / 2)) < Math.min(prev.h, line.h) * 0.4
    ) {
      const left = Math.min(prev.x, line.x);
      const right = Math.max(prev.x + prev.w, line.x + line.w);
      prev.text = `${prev.text} ${line.text}`;
      prev.x = left;
      prev.w = right - left;
      prev.h = Math.max(prev.h, line.h);
      return;
    }
    out.push(line);
  };

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const value = node.nodeValue ?? "";
    if (WS_ONLY.test(value)) continue;
    if (isHidden(node.parentElement, skipHosts)) continue;
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
    if (rects.length === 0) continue;
    if (rects.length === 1) {
      push(value, rects[0]!);
      continue;
    }
    // نص ملتفّ على عدة أسطر: نجمع الحروف حسب السطر.
    let cur: {
      text: string;
      rect: { left: number; right: number; top: number; bottom: number };
    } | null = null;
    const flush = () => {
      if (cur)
        push(cur.text, {
          left: cur.rect.left,
          top: cur.rect.top,
          width: cur.rect.right - cur.rect.left,
          height: cur.rect.bottom - cur.rect.top,
        });
      cur = null;
    };
    for (let i = 0; i < value.length; i++) {
      range.setStart(node, i);
      range.setEnd(node, i + 1);
      const cr = range.getBoundingClientRect();
      if (cr.width === 0 && cr.height === 0) {
        if (cur) (cur as { text: string }).text += value[i];
        continue;
      }
      const sameLine =
        cur &&
        Math.abs((cur.rect.top + cur.rect.bottom) / 2 - (cr.top + cr.bottom) / 2) < cr.height * 0.5;
      if (!sameLine) {
        flush();
        cur = {
          text: value[i]!,
          rect: { left: cr.left, right: cr.right, top: cr.top, bottom: cr.bottom },
        };
      } else if (cur) {
        const c = cur as {
          text: string;
          rect: { left: number; right: number; top: number; bottom: number };
        };
        c.text += value[i];
        c.rect.left = Math.min(c.rect.left, cr.left);
        c.rect.right = Math.max(c.rect.right, cr.right);
        c.rect.top = Math.min(c.rect.top, cr.top);
        c.rect.bottom = Math.max(c.rect.bottom, cr.bottom);
      }
    }
    flush();
  }
  return out;
}

/** مربعات الروابط الداخلية (الفهرس → الصفحة) من عناصر `data-toc-target`. */
export function collectLinkBoxes(page: HTMLElement): LinkBox[] {
  const pageRect = page.getBoundingClientRect();
  return Array.from(page.querySelectorAll<HTMLElement>("[data-toc-target]"))
    .map((el) => {
      const r = el.getBoundingClientRect();
      return {
        x: r.left - pageRect.left,
        y: r.top - pageRect.top,
        w: r.width,
        h: r.height,
        page: Number(el.dataset["tocTarget"]),
      };
    })
    .filter((b) => Number.isFinite(b.page) && b.w > 0 && b.h > 0);
}

/** مقاييس عروض الحروف من ملف TTF نفسه (cmap + hmtx) — هي نفسها المكتوبة في /W داخل PDF. */
export interface FontMetrics {
  unitsPerEm: number;
  advance(codePoint: number): number;
}

export function parseFontMetrics(buf: ArrayBuffer): FontMetrics {
  const v = new DataView(buf);
  const numTables = v.getUint16(4);
  const tables: Record<string, number> = {};
  for (let i = 0; i < numTables; i++) {
    const o = 12 + i * 16;
    const tag = String.fromCharCode(
      v.getUint8(o),
      v.getUint8(o + 1),
      v.getUint8(o + 2),
      v.getUint8(o + 3),
    );
    tables[tag] = v.getUint32(o + 8);
  }
  const unitsPerEm = v.getUint16(tables["head"]! + 18);
  const numHM = v.getUint16(tables["hhea"]! + 34);
  const hmtx = tables["hmtx"]!;
  const advGid = (gid: number) => v.getUint16(hmtx + 4 * Math.min(gid, numHM - 1));

  // cmap: نفضّل format 12 ثم format 4 (Unicode BMP).
  const cmapOff = tables["cmap"]!;
  const nSub = v.getUint16(cmapOff + 2);
  let f4 = -1;
  let f12 = -1;
  for (let i = 0; i < nSub; i++) {
    const platform = v.getUint16(cmapOff + 4 + i * 8);
    const enc = v.getUint16(cmapOff + 6 + i * 8);
    const off = cmapOff + v.getUint32(cmapOff + 8 + i * 8);
    const fmt = v.getUint16(off);
    if (fmt === 12 && (platform === 3 || platform === 0)) f12 = off;
    if (fmt === 4 && ((platform === 3 && enc === 1) || platform === 0)) f4 = off;
  }
  const gidOf = (cp: number): number => {
    if (f12 >= 0) {
      const n = v.getUint32(f12 + 12);
      for (let i = 0; i < n; i++) {
        const g = f12 + 16 + i * 12;
        const start = v.getUint32(g);
        const end = v.getUint32(g + 4);
        if (cp >= start && cp <= end) return v.getUint32(g + 8) + (cp - start);
      }
      return 0;
    }
    if (f4 >= 0 && cp <= 0xffff) {
      const segX2 = v.getUint16(f4 + 6);
      const endO = f4 + 14;
      const startO = endO + segX2 + 2;
      const deltaO = startO + segX2;
      const rangeO = deltaO + segX2;
      for (let i = 0; i < segX2; i += 2) {
        const end = v.getUint16(endO + i);
        if (cp > end) continue;
        const start = v.getUint16(startO + i);
        if (cp < start) return 0;
        const delta = v.getInt16(deltaO + i);
        const ro = v.getUint16(rangeO + i);
        if (ro === 0) return (cp + delta) & 0xffff;
        const gid = v.getUint16(rangeO + i + ro + (cp - start) * 2);
        return gid === 0 ? 0 : (gid + delta) & 0xffff;
      }
    }
    return 0;
  };
  const cache = new Map<number, number>();
  return {
    unitsPerEm,
    advance(cp: number) {
      let a = cache.get(cp);
      if (a === undefined) {
        a = advGid(gidOf(cp));
        cache.set(cp, a);
      }
      return a;
    },
  };
}

let fontPromise: Promise<{ b64: string; metrics: FontMetrics }> | null = null;
let metricsRef: FontMetrics | null = null;

async function loadFont(): Promise<{ b64: string; metrics: FontMetrics }> {
  const res = await fetch("/fonts/Changa-Variable.ttf");
  if (!res.ok) throw new Error(`font-${res.status}`);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { b64: btoa(bin), metrics: parseFontMetrics(buf) };
}

export const TEXT_FONT = "ChangaText";

let shapingDisabled = false;

/**
 * jsPDF يطبّق تلقائياً تشكيلاً عربياً (أشكال العرض) وإعادة ترتيب bidi على كل نص، فيُفسد النص
 * المستخرج (حروف ساقطة وترتيب معكوس). نصنا غير مرئي ومنطقي الترتيب، فنُلغي المعالجتين.
 * يجب استدعاؤها قبل إنشاء كائن jsPDF (الأحداث تُنسخ عند الإنشاء). آمنة للتكرار.
 */
export function disableJsPdfTextShaping(): void {
  if (shapingDisabled) return;
  const api = (
    jsPDF as unknown as {
      API?: { events?: [string, (...a: unknown[]) => unknown][]; processArabic?: unknown };
    }
  ).API;
  if (!api?.events) return;
  api.events = api.events.filter(([name, fn]) => {
    if (name === "preProcessText" && fn === api.processArabic) return false;
    if (name === "postProcessText" && String(fn).includes("doBidiReorder")) return false;
    return true;
  });
  shapingDisabled = true;
}

/** يسجّل خط النص في ملف PDF. يعيد false إن تعذّر (يبقى PDF صالحاً بلا طبقة نص). */
export async function registerTextFont(pdf: jsPDF): Promise<boolean> {
  try {
    fontPromise ??= loadFont();
    const { b64, metrics } = await fontPromise;
    metricsRef = metrics;
    pdf.addFileToVFS("Changa-Variable.ttf", b64);
    pdf.addFont("Changa-Variable.ttf", TEXT_FONT, "normal");
    return true;
  } catch (error) {
    fontPromise = null;
    console.warn(
      "[pdf] text layer font unavailable:",
      error instanceof Error ? error.message : String(error),
    );
    return false;
  }
}

const ARABIC_RE = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufeff]/;
const LTR_RUN = /([A-Za-z0-9][A-Za-z0-9.,:%/_\-+@#]*)/;

/**
 * قارئات PDF (Acrobat وChrome وpoppler…) تفترض أن نص PDF مخزَّن بالترتيب البصري وتُعيد ترتيب الأجزاء
 * العربية عند الاستخراج؛ لذا نكتب السطر بترتيب بصري: نعكس ترتيب المقاطع ونعكس حروف المقاطع العربية،
 * وتبقى مقاطع الأرقام واللاتينية كما هي. يُستعمل لسطر RTL فقط (فيه عربي).
 */
export function toVisualOrder(text: string): string {
  if (!ARABIC_RE.test(text)) return text;
  const parts = text.split(LTR_RUN).filter((p) => p !== "");
  return parts
    .map((p) => (LTR_RUN.test(p) && /^[A-Za-z0-9]/.test(p) ? p : [...p].reverse().join("")))
    .reverse()
    .join("");
}

/** يكتب أسطر النص بوضع invisible ويضبط عرض كل سطر ليطابق السطر المرئي (تحديد دقيق). */
export function addInvisibleText(
  pdf: jsPDF,
  lines: TextLine[],
  scaleX: number,
  scaleY: number,
): void {
  pdf.setFont(TEXT_FONT, "normal");
  for (const l of lines) {
    const text = toVisualOrder(l.text);
    // الحجم يتبع ارتفاع السطر، ثم يُضبط ليطابق عرضه المرئي (تحديد/إبراز دقيق دون تباعد حروف).
    let size = Math.max(4, Math.min(40, l.h * scaleY * 0.72));
    pdf.setFontSize(size);
    // العرض من مقاييس الخط الحقيقية (نفس ما يكتبه jsPDF في /W)، لا من getTextWidth الذي يخطئ في Unicode.
    const em = metricsRef
      ? [...text].reduce((w, ch) => w + metricsRef!.advance(ch.codePointAt(0)!), 0) /
        metricsRef.unitsPerEm
      : 0;
    const target = l.w * scaleX;
    if (em > 0 && target > 0) {
      size = Math.max(3, Math.min(size * 1.6, target / em));
      pdf.setFontSize(size);
    }
    try {
      pdf.text(text, l.x * scaleX, (l.y + l.h * 0.78) * scaleY, {
        baseline: "alphabetic",
        renderingMode: "invisible",
      });
    } catch {
      /* سطر يحوي رمزاً لا يدعمه الخط: نتجاوزه بدل إفشال التقرير */
    }
  }
}

export function addInternalLinks(
  pdf: jsPDF,
  boxes: LinkBox[],
  scaleX: number,
  scaleY: number,
): void {
  for (const b of boxes) {
    pdf.link(b.x * scaleX, b.y * scaleY, b.w * scaleX, b.h * scaleY, { pageNumber: b.page });
  }
}
