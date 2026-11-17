import type { Finding } from "./findings";

const SIZE = 1080;
const BG = "#FAF8F1";
const TEAL = "#287F74";
const PURPLE = "#735C9A";
const INK = "#263344";

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

/** يرسم بطاقة مشاركة مربعة (PNG) لنتيجة واحدة بهوية MIZYAi. */
export async function findingCardBlob(f: Finding): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  const ctx = c.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const glow = ctx.createRadialGradient(
    SIZE * 0.2,
    SIZE * 0.15,
    0,
    SIZE * 0.2,
    SIZE * 0.15,
    SIZE * 0.8,
  );
  glow.addColorStop(0, "rgba(141,223,208,0.16)");
  glow.addColorStop(1, "rgba(141,223,208,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, SIZE, SIZE);
  const glow2 = ctx.createRadialGradient(
    SIZE * 0.9,
    SIZE * 0.95,
    0,
    SIZE * 0.9,
    SIZE * 0.95,
    SIZE * 0.6,
  );
  glow2.addColorStop(0, "rgba(200,181,238,0.14)");
  glow2.addColorStop(1, "rgba(200,181,238,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const pad = 90;
  const font = "'Space Grotesk','Segoe UI',Tahoma,sans-serif";
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";

  ctx.fillStyle = TEAL;
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
  ctx.fillStyle = INK;
  const lh = fs * 1.55;
  let y = 330;
  for (const l of lines) {
    ctx.fillText(l, SIZE - pad, y);
    y += lh;
  }

  if (typeof f.bar === "number") {
    const w = SIZE - pad * 2;
    const by = Math.min(y + 30, 800);
    ctx.fillStyle = "rgba(38,51,68,0.08)";
    ctx.fillRect(pad, by, w, 14);
    ctx.fillStyle = PURPLE;
    const bw = (w * Math.max(0, Math.min(100, f.bar))) / 100;
    ctx.fillRect(SIZE - pad - bw, by, bw, 14);
  }

  ctx.fillStyle = "rgba(38,51,68,0.68)";
  ctx.font = `400 28px ${font}`;
  ctx.fillText(f.detail, SIZE - pad, 900);

  ctx.fillStyle = TEAL;
  ctx.font = `700 36px ${font}`;
  ctx.textAlign = "left";
  ctx.direction = "ltr";
  ctx.fillText("Basira", pad, 990);

  return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png"));
}
