/**
 * طبقة العرض «الزجاجي الداكن» لكل رسوم المنصة على الشاشة: تدرّجات هادئة،
 * توهّج خفيف للمنحنيات، شبكة متقطعة خافتة، ودونات بإجمالي في المنتصف.
 * تعمل على أي خيار ECharts (من المحوّل أو من المكوّنات) ولا تغيّر البيانات،
 * ولا تُطبَّق على تصدير PDF/PPTX.
 */
type Rec = Record<string, unknown>;

const PALETTE = ["#60F5D2", "#D6B2FC", "#7DD3FC", "#FDE68A", "#F9A8D4"];
const TEXT = "#A3B1C6";
const INK = "#EEF2F7";
const EDGE = "rgba(255,255,255,0.12)";
const GRID = "rgba(255,255,255,0.07)";

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
  return typeof document === "undefined" || document.documentElement.dataset["theme"] === "glass";
}

function compact(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(
    n,
  );
}

function skinAxis(axis: unknown): unknown {
  if (!axis || Array.isArray(axis) || typeof axis !== "object") return axis;
  const a = axis as Rec;
  const label = (a["axisLabel"] as Rec) ?? {};
  const isValue = a["type"] === "value";
  return {
    ...a,
    axisLine: isValue ? { show: false } : { lineStyle: { color: EDGE } },
    axisTick: { show: false },
    axisLabel: { ...label, color: TEXT },
    splitLine: isValue
      ? {
          ...((a["splitLine"] as Rec) ?? {}),
          show: true,
          lineStyle: { color: GRID, type: "dashed" },
        }
      : { show: false },
  };
}

export function glassify<T extends Rec>(option: T): T {
  const given = Array.isArray(option["color"]) ? (option["color"] as unknown[]).filter(isHex) : [];
  const colors = given.length ? given : PALETTE;
  const out: Rec = { ...option, color: colors };
  const c = (i: number) => colors[i % colors.length] ?? PALETTE[0]!;

  out["textStyle"] = {
    ...((option["textStyle"] as Rec) ?? {}),
    fontFamily:
      typeof document !== "undefined" ? getComputedStyle(document.body).fontFamily : "sans-serif",
  };
  out["animationDuration"] = 650;
  out["animationEasing"] = "cubicOut";

  out["tooltip"] = {
    ...((option["tooltip"] as Rec) ?? {}),
    backgroundColor: "rgba(8,18,38,0.94)",
    borderColor: EDGE,
    borderWidth: 1,
    textStyle: { color: INK },
    extraCssText: "backdrop-filter: blur(10px); border-radius: 12px;",
  };

  const series = ((option["series"] as Rec[]) ?? []).map((s) => ({ ...s }));
  const isPie = series[0]?.["type"] === "pie";
  const multi = series.length > 1;

  const legend = (option["legend"] as Rec | undefined) ?? {};
  if (isPie || multi) {
    out["legend"] = {
      ...legend,
      show: legend["show"] !== false,
      bottom: legend["bottom"] ?? 0,
      textStyle: { color: TEXT },
      icon: "circle",
      itemHeight: 8,
    };
  } else {
    out["legend"] = { show: false };
  }

  if (isPie) {
    const s = series[0]!;
    s["radius"] = ["62%", "82%"];
    s["avoidLabelOverlap"] = true;
    s["itemStyle"] = { borderRadius: 12, borderColor: "transparent", borderWidth: 3 };
    s["emphasis"] = {
      scaleSize: 6,
      itemStyle: { shadowBlur: 18, shadowColor: "rgba(96,245,210,0.35)" },
    };
    const data = (s["data"] as Rec[]) ?? [];
    s["data"] = data.map((d, i) => ({
      ...d,
      itemStyle: { color: gradient(c(i), rgba(c(i + 1), 0.7), true) },
    }));
    const total = data.reduce(
      (sum, d) => sum + (typeof d["value"] === "number" ? d["value"] : 0),
      0,
    );
    if (!option["title"] && total > 0) {
      out["title"] = {
        text: compact(total),
        subtext: "الإجمالي",
        left: "center",
        top: "center",
        itemGap: 4,
        textStyle: { color: INK, fontSize: 24, fontWeight: 600 },
        subtextStyle: { color: TEXT, fontSize: 11 },
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
      s["barMaxWidth"] = typeof s["barMaxWidth"] === "number" ? Math.min(s["barMaxWidth"], 28) : 26;
      s["itemStyle"] = {
        borderRadius: [8, 8, 0, 0],
        ...item,
        ...(solid
          ? { color: gradient(isHex(item["color"]) ? item["color"] : base, rgba(next, 0.55)) }
          : {}),
      };
      s["emphasis"] = { itemStyle: { shadowBlur: 14, shadowColor: rgba(base, 0.4) } };
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
      if (s["areaStyle"]) s["areaStyle"] = { color: gradient(rgba(base, 0.38), rgba(base, 0)) };
    } else if (type === "scatter") {
      s["itemStyle"] = {
        ...((s["itemStyle"] as Rec) ?? {}),
        color: rgba(base, 0.85),
        shadowBlur: 10,
        shadowColor: rgba(base, 0.5),
      };
    }
  });
  out["series"] = series;

  const xAxis = option["xAxis"] as Rec | undefined;
  out["xAxis"] = skinAxis(xAxis);
  out["yAxis"] = skinAxis(option["yAxis"]);
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
