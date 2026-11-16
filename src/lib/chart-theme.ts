/** ألوان وتدرجات الرسوم حسب الثيم الحالي (الزجاجي الداكن افتراضياً). */
export function isGlassTheme(): boolean {
  return typeof document === "undefined" || document.documentElement.dataset["theme"] === "glass";
}

function vGradient(top: string, bottom: string) {
  return {
    type: "linear" as const,
    x: 0,
    y: 0,
    x2: 0,
    y2: 1,
    colorStops: [
      { offset: 0, color: top },
      { offset: 1, color: bottom },
    ],
  };
}
function hGradient(left: string, right: string) {
  return { ...vGradient(left, right), x2: 1, y2: 0 };
}

export function chartTheme() {
  const glass = isGlassTheme();
  const teal = glass ? "#60F5D2" : "#287F74";
  const lav = glass ? "#D6B2FC" : "#735C9A";
  return {
    glass,
    teal,
    lav,
    axisLabel: { color: glass ? "#A3B1C6" : "#78818A", hideOverlap: true },
    axisLine: { show: true, lineStyle: { color: glass ? "rgba(255,255,255,0.12)" : "#E7E3DA" } },
    axisTick: { show: false },
    splitLine: {
      show: true,
      lineStyle: { color: glass ? "rgba(255,255,255,0.07)" : "#EFEBE2", type: "dashed" as const },
    },
    tooltip: glass
      ? {
          backgroundColor: "rgba(8,18,38,0.94)",
          borderColor: "rgba(255,255,255,0.14)",
          borderWidth: 1,
          textStyle: { color: "#EEF2F7" },
          extraCssText: "backdrop-filter: blur(10px); border-radius: 12px;",
        }
      : {},
    barFill: glass ? vGradient("#60F5D2", "rgba(125,120,255,0.55)") : teal,
    barFillH: glass ? hGradient("rgba(214,178,252,0.55)", "#D6B2FC") : lav,
    areaFill: glass ? vGradient("rgba(96,245,210,0.38)", "rgba(96,245,210,0)") : undefined,
  };
}
