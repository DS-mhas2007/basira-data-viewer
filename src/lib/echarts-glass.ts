/**
 * طبقة العرض «الزجاجي الداكن» لكل رسوم المنصة على الشاشة: تدرّجات هادئة،
 * توهّج خفيف للمنحنيات، شبكة متقطعة خافتة، ودونات بإجمالي في المنتصف.
 * تعمل على أي خيار ECharts (من المحوّل أو من المكوّنات) ولا تغيّر البيانات،
 * ولا تُطبَّق على تصدير PDF/PPTX.
 */
type Rec = Record<string, unknown>;

export type GlassMode = "dark" | "light";

interface Tone {
  palette: string[];
  text: string;
  ink: string;
  edge: string;
  grid: string;
  tipBg: string;
  pieBorder: string;
  teal: string;
  lav: string;
}

const TONES: Record<GlassMode, Tone> = {
  dark: {
    palette: ["#60F5D2", "#D6B2FC", "#7DD3FC", "#FDE68A", "#F9A8D4"],
    text: "#A3B1C6",
    ink: "#EEF2F7",
    edge: "rgba(255,255,255,0.12)",
    grid: "rgba(255,255,255,0.07)",
    tipBg: "rgba(8,18,38,0.94)",
    pieBorder: "#0a1730",
    teal: "#60F5D2",
    lav: "#D6B2FC",
  },
  light: {
    palette: ["#14B89B", "#A77CE8", "#4FB4E8", "#E0AE2E", "#E879B0"],
    text: "#4A5A72",
    ink: "#0B1B33",
    edge: "rgba(11,27,51,0.14)",
    grid: "rgba(11,27,51,0.08)",
    tipBg: "rgba(255,255,255,0.96)",
    pieBorder: "#ffffff",
    teal: "#14B89B",
    lav: "#A77CE8",
  },
};

/** الوضع الزجاجي الحالي (null = الثيم القديم غير الزجاجي). */
export function glassMode(): GlassMode | null {
  if (typeof document === "undefined") return "dark";
  const t = document.documentElement.dataset["theme"];
  return t === "glass" ? "dark" : t === "glass-light" ? "light" : null;
}

const toneNow = (): Tone => TONES[glassMode() ?? "dark"];

/** تيل ولافندر الهوية بحسب الوضع (للنقاط والتدرجات خارج ECharts). */
export function glassBrand(): { teal: string; lav: string } {
  const t = toneNow();
  return { teal: t.teal, lav: t.lav };
}

function rgba(hex: string, a: number): string {
  const raw = hex.replace("#", "");
  const full = raw.length <= 4 ? [...raw].map((c) => c + c).join("") : raw;
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function isHex(v: unknown): v is string {
  return typeof v === "string" && /^#[\da-f]{3,8}$/i.test(v);
}

function gradient(from: string, to: string, horizontal = false) {
  return {
    type: "linear" as const,
    x: 0,
    y: 0,
    x2: horizontal ? 1 : 0,
    y2: horizontal ? 0 : 1,
    colorStops: [
      { offset: 0, color: from },
      { offset: 1, color: to },
    ],
  };
}

export function isGlassTheme(): boolean {
  return glassMode() !== null;
}

function compact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    n,
  );
}

function skinAxis(axis: unknown, tone: Tone): unknown {
  if (!axis || Array.isArray(axis) || typeof axis !== "object") return axis;
  const a = axis as Rec;
  const label = (a["axisLabel"] as Rec) ?? {};
  const isValue = a["type"] === "value";
  return {
    ...a,
    axisLine: isValue ? { show: false } : { lineStyle: { color: tone.edge } },
    axisTick: { show: false },
    axisLabel: { ...label, color: tone.text },
    splitLine: isValue
      ? {
          ...((a["splitLine"] as Rec) ?? {}),
          show: true,
          lineStyle: { color: tone.grid, type: "dashed" },
        }
      : { show: false },
  };
}

/** يمزج لونين hex بنسبة t (0..1). */
export function mixHex(a: string, b: string, t: number): string {
  const ch = (h: string) => [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16));
  const [pa, pb] = [ch(a), ch(b)];
  const m = pa.map((v, i) => Math.round(v + (pb[i]! - v) * t));
  return `#${m.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** ألوان شرائح الدونات: تدرّج تيل ← لافندر موحّد على كل الشرائح. */
export function sliceColors(n: number): string[] {
  const { teal, lav } = glassBrand();
  return Array.from({ length: n }, (_, i) => mixHex(teal, lav, n <= 1 ? 0 : i / (n - 1)));
}

export interface GlassOptions {
  /** نمط اللوحة: بلا مفتاح/عنوان داخل الرسم (المعلومات تُعرض بجانبه في البطاقة). */
  bare?: boolean;
}

export function glassify<T extends Rec>(option: T, opts: GlassOptions = {}): T {
  const bare = opts.bare === true;
  const tone = toneNow();
  const PALETTE = tone.palette;
  const given = Array.isArray(option["color"]) ? (option["color"] as unknown[]).filter(isHex) : [];
  // في الوضع الفاتح نستبدل ألوان الباليت الداكنة المعروفة بنظيراتها الأعمق.
  const swap = (h: string) => {
    if (glassMode() !== "light") return h;
    const i = TONES.dark.palette.findIndex((d) => d.toLowerCase() === h.toLowerCase());
    return i >= 0 ? TONES.light.palette[i]! : h;
  };
  const colors = bare ? PALETTE : given.length ? given.map(swap) : PALETTE;
  const out: Rec = { ...option, color: colors };
  const c = (i: number) => colors[i % colors.length] ?? PALETTE[0]!;

  out["textStyle"] = {
    ...((option["textStyle"] as Rec) ?? {}),
    fontFamily:
      typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily : "sans-serif",
  };
  // حركة الدخول: الأعمدة تنمو متتابعة، الخط يُرسم، الدونات تتمدّد؛ وتُعطَّل عند تفضيل تقليل الحركة.
  const reduced =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  out["animation"] = !reduced;
  out["animationDuration"] = 1100;
  out["animationEasing"] = "cubicOut";
  out["animationDurationUpdate"] = 600;
  out["animationEasingUpdate"] = "cubicInOut";

  out["tooltip"] = {
    ...((option["tooltip"] as Rec) ?? {}),
    backgroundColor: tone.tipBg,
    borderColor: tone.edge,
    borderWidth: 1,
    textStyle: { color: tone.ink },
    extraCssText: "backdrop-filter: blur(10px); border-radius: 12px;",
  };

  const series = ((option["series"] as Rec[]) ?? []).map((s) => ({ ...s }));
  const isPie = series[0]?.["type"] === "pie";
  const multi = series.length > 1;

  const legend = (option["legend"] as Rec | undefined) ?? {};
  if ((isPie || multi) && !(bare && isPie)) {
    out["legend"] = {
      ...legend,
      show: legend["show"] !== false,
      bottom: legend["bottom"] ?? 0,
      textStyle: { color: tone.text },
      icon: "circle",
      itemHeight: 8,
    };
  } else {
    out["legend"] = { show: false };
  }

  if (isPie) {
    const s = series[0]!;
    s["radius"] = bare ? ["54%", "86%"] : ["62%", "82%"];
    s["avoidLabelOverlap"] = true;
    s["itemStyle"] = bare
      ? { borderRadius: 6, borderColor: tone.pieBorder, borderWidth: 3 }
      : { borderRadius: 12, borderColor: "transparent", borderWidth: 3 };
    if (bare) {
      s["label"] = { show: false };
      s["labelLine"] = { show: false };
    }
    s["emphasis"] = {
      scale: true,
      scaleSize: 8,
      itemStyle: { shadowBlur: 22, shadowColor: "rgba(96,245,210,0.4)" },
    };
    s["animationType"] = "expansion";
    s["animationDuration"] = 1300;
    s["animationEasing"] = "cubicOut";
    s["animationDelay"] = (idx: number) => Math.min(idx, 12) * 110;
    const data = (s["data"] as Rec[]) ?? [];
    const ring = sliceColors(data.length);
    s["data"] = data.map((d, i) => ({
      ...d,
      itemStyle: bare
        ? { color: gradient(ring[i]!, rgba(ring[(i + 1) % ring.length]!, 0.85)) }
        : { color: gradient(c(i), rgba(c(i + 1), 0.7), true) },
    }));
    const total = data.reduce(
      (sum, d) => sum + (typeof d["value"] === "number" ? d["value"] : 0),
      0,
    );
    if (!bare && !option["title"] && total > 0) {
      out["title"] = {
        text: compact(total),
        subtext: "الإجمالي",
        left: "center",
        top: "center",
        itemGap: 4,
        textStyle: { color: tone.ink, fontSize: 24, fontWeight: 600 },
        subtextStyle: { color: tone.text, fontSize: 11 },
      };
    }
    out["series"] = series;
    return out as T;
  }

  series.forEach((s, i) => {
    const base = c(i);
    const next = c(i + 1);
    const type = s["type"];
    if (type === "bar") {
      const item = (s["itemStyle"] as Rec) ?? {};
      const solid = item["color"] === undefined || typeof item["color"] === "string";
      s["barMaxWidth"] = bare
        ? 16
        : typeof s["barMaxWidth"] === "number"
          ? Math.min(s["barMaxWidth"], 28)
          : 26;
      s["itemStyle"] = {
        borderRadius: bare ? 8 : [8, 8, 0, 0],
        ...item,
        ...(solid
          ? bare
            ? // نمط المرجع: لافندر في الأعلى يتلاشى إلى تيل في القاعدة
              {
                color: gradient(i === 0 ? tone.lav : base, i === 0 ? tone.teal : rgba(next, 0.55)),
              }
            : { color: gradient(isHex(item["color"]) ? item["color"] : base, rgba(next, 0.55)) }
          : {}),
      };
      s["emphasis"] = {
        focus: "self",
        itemStyle: { shadowBlur: 18, shadowColor: rgba(base, 0.55) },
      };
      s["blur"] = { itemStyle: { opacity: 0.45 } };
      s["animationDuration"] = 900;
      s["animationEasing"] = "elasticOut";
      s["animationDelay"] = (idx: number) => Math.min(idx, 40) * 45;
    } else if (type === "line") {
      const line = (s["lineStyle"] as Rec) ?? {};
      const dashed = line["type"] === "dashed";
      s["symbol"] = "none";
      s["smooth"] = s["smooth"] ?? true;
      s["lineStyle"] = {
        width: 2.5,
        ...line,
        color: isHex(line["color"]) ? line["color"] : base,
        ...(dashed ? {} : { shadowBlur: 12, shadowColor: rgba(base, 0.55) }),
      };
      s["itemStyle"] = { ...((s["itemStyle"] as Rec) ?? {}), color: base };
      s["emphasis"] = { focus: "series", lineStyle: { width: 3.5 } };
      s["animationDuration"] = 1600;
      s["animationEasing"] = "cubicInOut";
      if (s["areaStyle"])
        s["areaStyle"] = { color: gradient(rgba(base, bare ? 0.45 : 0.38), rgba(base, 0)) };
    } else if (type === "scatter") {
      s["animationDelay"] = (idx: number) => Math.min(idx, 60) * 18;
      s["itemStyle"] = {
        ...((s["itemStyle"] as Rec) ?? {}),
        color: rgba(base, 0.85),
        shadowBlur: 10,
        shadowColor: rgba(base, 0.5),
      };
    }
  });
  out["series"] = series;
  applyLargeDataGuards(out, series);

  const xAxis = option["xAxis"] as Rec | undefined;
  out["xAxis"] = skinAxis(xAxis, tone);
  out["yAxis"] = skinAxis(option["yAxis"], tone);
  if (xAxis && !Array.isArray(xAxis) && xAxis["type"] === "category") {
    const labels = Array.isArray(xAxis["data"]) ? (xAxis["data"] as unknown[]) : [];
    const flat =
      labels.length > 0 &&
      (labels.length <= 8 || (labels.length <= 14 && labels.every((l) => String(l).length <= 8)));
    if (flat) {
      const x = out["xAxis"] as Rec;
      out["xAxis"] = { ...x, axisLabel: { ...(x["axisLabel"] as Rec), rotate: 0 } };
      out["grid"] = {
        ...((option["grid"] as Rec) ?? {}),
        bottom: multi ? 40 : 24,
        containLabel: true,
      };
    }
  }
  return out as T;
}


/** عدد النقاط الذي يبدأ عنده تبسيط الرسم كي لا تتجمّد الصفحة. */
export const LARGE_POINTS = 2000;

/**
 * رسوم البيانات الكبيرة: حركة الدخول والظلال (shadowBlur) تُكلّف مع آلاف النقاط، فنعطّلها ونفعّل
 * التبسيط الذكي للخطوط (lttb) ووضع large للنقاط المبعثرة. لا يغيّر شيئاً مع الرسوم الصغيرة.
 */
export function applyLargeDataGuards(out: Rec, series: Rec[]): void {
  const points = series.reduce((n, s) => n + (Array.isArray(s["data"]) ? (s["data"] as unknown[]).length : 0), 0);
  if (points < LARGE_POINTS) return;
  out["animation"] = false;
  for (const s of series) {
    const type = s["type"];
    if (type === "line") {
      s["sampling"] = s["sampling"] ?? "lttb";
      const ls = (s["lineStyle"] as Rec | undefined) ?? {};
      s["lineStyle"] = { ...ls, shadowBlur: 0 };
      s["showSymbol"] = false;
    } else if (type === "scatter") {
      s["large"] = true;
      s["largeThreshold"] = 1000;
      const is = (s["itemStyle"] as Rec | undefined) ?? {};
      s["itemStyle"] = { ...is, shadowBlur: 0 };
    } else if (type === "bar") {
      s["large"] = true;
      s["largeThreshold"] = 1000;
    }
  }
}
