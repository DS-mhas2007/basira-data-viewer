import { glassMode, isGlassTheme } from "@/lib/echarts-glass";

export { isGlassTheme };

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

/** ألوان وتدرجات الرسوم حسب الثيم الحالي (زجاجي داكن/فاتح، أو القديم). */
export function chartTheme() {
  const mode = glassMode();
  const glass = mode !== null;
  const light = mode === "light";
  const teal = light ? "#14B89B" : glass ? "#60F5D2" : "#287F74";
  const lav = light ? "#A77CE8" : glass ? "#D6B2FC" : "#735C9A";
  const rgb = light ? "20,184,155" : "96,245,210";
  const edge = light ? "rgba(11,27,51,0.14)" : "rgba(255,255,255,0.12)";
  return {
    glass,
    teal,
    lav,
    axisLabel: { color: glass ? (light ? "#4A5A72" : "#A3B1C6") : "#78818A", hideOverlap: true },
    axisLine: { show: true, lineStyle: { color: glass ? edge : "#E7E3DA" } },
    axisTick: { show: false },
    splitLine: {
      show: true,
      lineStyle: {
        color: glass ? (light ? "rgba(11,27,51,0.08)" : "rgba(255,255,255,0.07)") : "#EFEBE2",
        type: "dashed" as const,
      },
    },
    tooltip: glass
      ? {
          backgroundColor: light ? "rgba(255,255,255,0.96)" : "rgba(8,18,38,0.94)",
          borderColor: edge,
          borderWidth: 1,
          textStyle: { color: light ? "#0B1B33" : "#EEF2F7" },
          extraCssText: "backdrop-filter: blur(10px); border-radius: 12px;",
        }
      : {},
    barFill: glass ? vGradient(lav, teal) : teal,
    barFillH: glass ? hGradient(`${lav}`, teal) : lav,
    areaFill: glass ? vGradient(`rgba(${rgb},0.38)`, `rgba(${rgb},0)`) : undefined,
  };
}
