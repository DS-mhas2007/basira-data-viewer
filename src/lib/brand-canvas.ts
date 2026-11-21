/**
 * أدوات رسم الهوية (الشعار + MIZYAi) على الكانفاس لصور المشاركة والتصدير.
 * تُحمَّل صور الشعار من public/brand (PNG عالي الدقة) وتتراجع بهدوء إن تعذّر التحميل.
 */
export const BRAND = {
  bg: "#010A19",
  teal: "#60F5D2",
  lavender: "#D6B2FC",
  ink: "#EEF2F7",
  /** عائلات الخط المستخدمة في الواجهة (تُحمَّل مسبقاً قبل الرسم). */
  font: "'Changa','Noto Sans Arabic','Segoe UI',Tahoma,sans-serif",
} as const;

export const LOCKUP_DARK = "/brand/mizya-lockup-horizontal-dark.png"; // نص أبيض: للخلفيات الداكنة
export const LOCKUP_LIGHT = "/brand/mizya-lockup-horizontal-light.png"; // نص داكن: للخلفيات الفاتحة
/** نسبة عرض/ارتفاع الشعار الأفقي كما في الملف (2400×913). */
export const LOCKUP_RATIO = 2400 / 913;

export function loadImage(src: string, timeoutMs = 4000): Promise<HTMLImageElement | null> {
  if (typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

/** يتأكد من تحميل خطوط الواجهة قبل الرسم حتى لا يرسم الكانفاس بخط بديل. */
export async function ensureBrandFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load("600 34px Changa"),
      document.fonts.load("700 60px Changa"),
      document.fonts.load("400 28px Changa"),
    ]);
  } catch {
    /* نكمل بالخط الاحتياطي */
  }
}

/** يرسم الشعار الأفقي بالارتفاع المطلوب؛ وإن تعذّر يرسم اسم MIZYAi نصاً. */
export function drawLockup(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  height: number,
  textColor: string,
): number {
  if (img) {
    const w = height * LOCKUP_RATIO;
    ctx.drawImage(img, x, y, w, height);
    return w;
  }
  ctx.save();
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = textColor;
  ctx.font = `700 ${Math.round(height * 0.6)}px ${BRAND.font}`;
  ctx.fillText("MIZYAi", x, y + height / 2);
  const w = ctx.measureText("MIZYAi").width;
  ctx.restore();
  return w;
}

/**
 * يضيف شريط هوية سفلي (شعار + MIZYAi) أسفل صورة جاهزة (data URL) ويعيد صورة جديدة.
 * عند أي فشل يعيد الصورة الأصلية كما هي.
 */
export async function withBrandFooter(
  dataUrl: string,
  opts: { background: string; hairline: string; lockup: "light" | "dark"; textColor: string },
): Promise<string> {
  if (typeof document === "undefined") return dataUrl;
  const base = await loadImage(dataUrl, 8000);
  if (!base) return dataUrl;
  const logo = await loadImage(opts.lockup === "dark" ? LOCKUP_DARK : LOCKUP_LIGHT);
  const w = base.naturalWidth;
  const footerH = Math.round(Math.max(88, w * 0.075));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = base.naturalHeight + footerH;
  const ctx = c.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.fillStyle = opts.background;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(base, 0, 0);
  ctx.fillStyle = opts.hairline;
  ctx.fillRect(0, base.naturalHeight, w, 2);
  const lockH = Math.round(footerH * 0.52);
  const pad = Math.round(footerH * 0.42);
  drawLockup(ctx, logo, pad, base.naturalHeight + (footerH - lockH) / 2, lockH, opts.textColor);
  return c.toDataURL("image/png");
}
