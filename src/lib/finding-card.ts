import { BRAND, LOCKUP_DARK, drawLockup, ensureBrandFonts, loadImage } from "./brand-canvas";
import type { Finding } from "./findings";

const SIZE = 1080;

/** يقسم النص إلى أسطر تناسب العرض (يعتمد على قياس الكانفاس). */
export function wrapWords(
  measure: (s: string) => number,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && measure(next) > maxWidth) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** يرسم بطاقة مشاركة مربعة (PNG) لنتيجة واحدة بهوية MIZYAi (خلفية داكنة + الشعار). */
export async function findingCardBlob(f: Finding): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  await ensureBrandFonts();
  const logo = await loadImage(LOCKUP_DARK);
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  // خلفية الهوية + توهّج أخضر مزرق/أرجواني
  ctx.fillStyle = BRAND.bg;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const glow = ctx.createRadialGradient(SIZE * 0.15, SIZE * 0.1, 0, SIZE * 0.15, SIZE * 0.1, SIZE * 0.85);
  glow.addColorStop(0, "rgba(96,245,210,0.17)");
  glow.addColorStop(1, "rgba(96,245,210,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const glow2 = ctx.createRadialGradient(SIZE * 0.95, SIZE * 0.95, 0, SIZE * 0.95, SIZE * 0.95, SIZE * 0.7);
  glow2.addColorStop(0, "rgba(214,178,252,0.18)");
  glow2.addColorStop(1, "rgba(214,178,252,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, SIZE, SIZE);
  // نجوم صغيرة ثابتة (نفس روح هوية MIZYAi)
  for (let i = 0; i < 46; i++) {
    const x = (i * 331 + 97) % SIZE;
    const y = (i * 197 + 41) % 330;
    ctx.fillStyle = `rgba(238,242,247,${0.1 + ((i * 7) % 5) * 0.06})`;
    ctx.beginPath();
    ctx.arc(x, y, i % 6 === 0 ? 2.2 : 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  const pad = 90;
  const font = BRAND.font;
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = BRAND.teal;
  ctx.font = `600 34px ${font}`;
  ctx.fillText("ما وجدناه في البيانات", SIZE - pad, 150);

  const text = f.text;
  let fs = 68;
  let lines: string[] = [];
  for (; fs >= 44; fs -= 4) {
    ctx.font = `700 ${fs}px ${font}`;
    lines = wrapWords((s) => ctx.measureText(s).width, text, SIZE - pad * 2);
    if (lines.length <= 6) break;
  }
  ctx.fillStyle = BRAND.ink;
  const lh = fs * 1.55;
  let y = 330;
  for (const l of lines) {
    ctx.fillText(l, SIZE - pad, y);
    y += lh;
  }

  if (typeof f.bar === "number") {
    const w = SIZE - pad * 2;
    const by = Math.min(y + 30, 760);
    ctx.fillStyle = "rgba(238,242,247,0.12)";
    ctx.fillRect(pad, by, w, 14);
    const bw = (w * Math.max(0, Math.min(100, f.bar))) / 100;
    const grad = ctx.createLinearGradient(SIZE - pad - bw, 0, SIZE - pad, 0);
    grad.addColorStop(0, BRAND.lavender);
    grad.addColorStop(1, BRAND.teal);
    ctx.fillStyle = grad;
    ctx.fillRect(SIZE - pad - bw, by, bw, 14);
  }

  ctx.fillStyle = "rgba(238,242,247,0.7)";
  ctx.font = `400 28px ${font}`;
  ctx.fillText(f.detail, SIZE - pad, 850);

  // تذييل الهوية: خط فاصل + الشعار الأفقي (الأيقونة + MIZYAi)
  ctx.fillStyle = "rgba(238,242,247,0.12)";
  ctx.fillRect(pad, 900, SIZE - pad * 2, 2);
  drawLockup(ctx, logo, pad, 925, 96, BRAND.ink);

  return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));
}
