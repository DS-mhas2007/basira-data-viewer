/**
 * أصوات تفاعلية خفيفة جداً (Web Audio) — بلا ملفات صوتية ولا شبكة.
 * قابلة للإيقاف، والتفضيل محفوظ في localStorage.
 */
const KEY = "basira:sfx";

let ctx: AudioContext | null = null;

export function sfxEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) !== "off";
}

export function setSfxEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, on ? "on" : "off");
}

type Tone = { f: number; t: number; d: number; g?: number };

const PRESETS: Record<"tap" | "success" | "export" | "trophy", Tone[]> = {
  tap: [{ f: 880, t: 0, d: 0.05, g: 0.04 }],
  success: [
    { f: 660, t: 0, d: 0.09, g: 0.05 },
    { f: 990, t: 0.08, d: 0.12, g: 0.045 },
  ],
  export: [
    { f: 520, t: 0, d: 0.08, g: 0.045 },
    { f: 780, t: 0.07, d: 0.1, g: 0.04 },
  ],
  trophy: [
    { f: 660, t: 0, d: 0.1, g: 0.05 },
    { f: 880, t: 0.09, d: 0.1, g: 0.05 },
    { f: 1320, t: 0.18, d: 0.22, g: 0.045 },
  ],
};

export function playSfx(name: keyof typeof PRESETS) {
  if (typeof window === "undefined" || !sfxEnabled()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const now = ctx.currentTime;
    for (const tone of PRESETS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = tone.f;
      const peak = tone.g ?? 0.04;
      gain.gain.setValueAtTime(0.0001, now + tone.t);
      gain.gain.exponentialRampToValueAtTime(peak, now + tone.t + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.t + tone.d);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + tone.t);
      osc.stop(now + tone.t + tone.d + 0.02);
    }
  } catch {
    /* الصوت رفاهية — نتجاهل أي فشل */
  }
}
