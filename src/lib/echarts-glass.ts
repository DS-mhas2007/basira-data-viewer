/**
 * طبقة العرض «الزجاجي الداكن» فوق خيارات ECharts: تدرّجات، توهّج هادئ، شبكة خافتة.
 * تُطبَّق على الشاشة فقط (لا على تصدير PDF/PPTX) ولا تغيّر البيانات أو عقد المحوّل.
 */
import type { EChartsOption } from "@/lib/echarts-adapter";

type Rec = Record<string, unknown>;

const TEXT = "#A3B1C6";
const EDGE = "rgba(255,255,255,0.12)";
const GRID = "rgba(255,255,255,0.07)";

function rgba(hex: string, a: number): string {
  const raw = hex.replace("#", "");
  const full = raw.length <= 4 ? [...raw].map((c) => c + c).join("") : raw;
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
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

export function glassify(option: EChartsOption): EChartsOption {
  const colors = option.color;
  const c0 = colors[0] ?? "#60F5D2";
  const c1 = colors[1] ?? "#D6B2FC";
  const out: EChartsOption = { ...option };

  out["tooltip"] = {
    ...option.tooltip,
    backgroundColor: "rgba(8,18,38,0.94)",
    borderColor: EDGE,
    borderWidth: 1,
    textStyle: { color: "#EEF2F7" },
    extraCssText: "backdrop-filter: blur(10px); border-radius: 12px;",
  };

  const series = option.series.map((s) => ({ ...s }));
  const first = series[0] as Rec | undefined;
  const isPie = first?.["type"] === "pie";

  // أسطورة الألوان لا تفيد حين تكون هناك سلسلة واحدة غير دائرية.
  if (series.length === 1 && !isPie) out["legend"] = { show: false };
  else
    out["legend"] = {
      ...(option["legend"] as Rec),
      textStyle: { color: TEXT },
      icon: "circle",
      itemHeight: 8,
    };

  if (isPie && first) {
    first["radius"] = ["62%", "82%"];
    first["avoidLabelOverlap"] = true;
    first["itemStyle"] = { borderRadius: 12, borderColor: "transparent", borderWidth: 3 };
    const data = (first["data"] as Rec[]) ?? [];
    first["data"] = data.map((d, i) => {
      const a = colors[i % colors.length] ?? c0;
      const b = colors[(i + 1) % colors.length] ?? c1;
      return { ...d, itemStyle: { color: gradient(a, rgba(b, 0.7), true) } };
    });
    out["series"] = series;
    return out;
  }

  for (const s of series) {
    if (s["type"] === "bar") {
      s["barMaxWidth"] = 26;
      s["itemStyle"] = {
        ...(s["itemStyle"] as Rec),
        color: gradient(c0, rgba(c1, 0.55)),
      };
    } else if (s["type"] === "line") {
      s["symbol"] = "none";
      s["lineStyle"] = {
        ...(s["lineStyle"] as Rec),
        width: 2.5,
        shadowBlur: 12,
        shadowColor: rgba(c0, 0.55),
      };
      if (s["areaStyle"]) s["areaStyle"] = { color: gradient(rgba(c0, 0.38), rgba(c0, 0)) };
    }
  }
  out["series"] = series;

  const xAxis = option["xAxis"] as Rec | undefined;
  if (xAxis) {
    const labels = Array.isArray(xAxis["data"]) ? (xAxis["data"] as unknown[]) : [];
    const count = labels.length;
    const short = labels.every((l) => String(l).length <= 8);
    const flat = count > 0 && (count <= 8 || (count <= 14 && short));
    const label = (xAxis["axisLabel"] as Rec) ?? {};
    out["xAxis"] = {
      ...xAxis,
      axisLine: { lineStyle: { color: EDGE } },
      axisTick: { show: false },
      axisLabel: { ...label, color: TEXT, ...(flat ? { rotate: 0 } : {}) },
    };
    if (flat) {
      out["grid"] = { ...(option["grid"] as Rec), bottom: 24 };
    }
  }
  const yAxis = option["yAxis"] as Rec | undefined;
  if (yAxis) {
    const label = (yAxis["axisLabel"] as Rec) ?? {};
    out["yAxis"] = {
      ...yAxis,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { ...label, color: TEXT },
      splitLine: { ...(yAxis["splitLine"] as Rec), lineStyle: { color: GRID, type: "dashed" } },
    };
  }
  return out;
}
