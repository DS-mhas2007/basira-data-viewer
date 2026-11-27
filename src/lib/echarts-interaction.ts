import { formatValue, type ChartConfig } from "@/lib/chart-studio";

/** أقل عدد فئات يستحق شريط تكبير وتنقل. */
export const ZOOM_MIN_POINTS = 14;
/** أصغر نافذة مسموحة (نسبة مئوية من المحور) كي لا يُكبَّر الرسم إلى نقطة واحدة. */
export const ZOOM_MIN_SPAN = 8;

const ZOOM_KINDS: ChartConfig["kind"][] = [
  "bar",
  "horizontalBar",
  "stacked",
  "line",
  "area",
  "combo",
];

type Opt = Record<string, unknown>;

function categoryCount(option: Opt, horizontal: boolean): number {
  const axis = option[horizontal ? "yAxis" : "xAxis"] as Opt | Opt[] | undefined;
  const a = Array.isArray(axis) ? axis[0] : axis;
  const data = a?.["data"];
  return Array.isArray(data) ? data.length : 0;
}

export function isZoomable(option: Opt, config: Pick<ChartConfig, "kind">): boolean {
  if (!ZOOM_KINDS.includes(config.kind)) return false;
  return categoryCount(option, config.kind === "horizontalBar") >= ZOOM_MIN_POINTS;
}

/** نافذة التكبير بعد إجراء من لوحة المفاتيح أو الأزرار. تُعيد null إن لم يتغير شيء. */
export type ZoomAction = "in" | "out" | "left" | "right" | "reset";
export function nextZoomRange(
  start: number,
  end: number,
  action: ZoomAction,
): { start: number; end: number } {
  if (action === "reset") return { start: 0, end: 100 };
  const span = end - start;
  const mid = (start + end) / 2;
  let s = start;
  let e = end;
  if (action === "in" || action === "out") {
    const nextSpan = Math.min(
      100,
      Math.max(ZOOM_MIN_SPAN, action === "in" ? span * 0.7 : span / 0.7),
    );
    s = mid - nextSpan / 2;
    e = mid + nextSpan / 2;
  } else {
    const step = Math.max(2, span * 0.2);
    // المحور RTL: السهم الأيمن يتجه نحو بداية البيانات.
    const d = action === "right" ? -step : step;
    s += d;
    e += d;
  }
  if (s < 0) {
    e -= s;
    s = 0;
  }
  if (e > 100) {
    s -= e - 100;
    e = 100;
  }
  return {
    start: Math.max(0, Math.round(s * 10) / 10),
    end: Math.min(100, Math.round(e * 10) / 10),
  };
}

const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/**
 * تلميح غني للمخطط ذي السلسلة الواحدة: القيمة بوحدتها، النسبة من الإجمالي، والترتيب.
 * لا يُستخدم مع السلاسل المتعددة (يبقى التلميح الافتراضي).
 */
function richTooltip(option: Opt, config: ChartConfig): Opt | null {
  const series = option["series"] as Opt[] | undefined;
  const tip = option["tooltip"] as Opt | undefined;
  if (!series || series.length !== 1 || !tip || tip["trigger"] !== "axis") return null;
  const data = (series[0]!["data"] as unknown[]).map((d) =>
    typeof d === "number"
      ? d
      : typeof (d as Opt)?.["value"] === "number"
        ? ((d as Opt)["value"] as number)
        : null,
  );
  const nums = data.filter((v): v is number => v !== null);
  if (nums.length < 2 || nums.some((v) => v < 0)) return null;
  const total = nums.reduce((a, b) => a + b, 0);
  const sorted = [...nums].sort((a, b) => b - a);
  return {
    ...tip,
    formatter: (params: unknown) => {
      const p = (Array.isArray(params) ? params[0] : params) as
        { name?: unknown; value?: unknown } | undefined;
      if (!p || typeof p.value !== "number") return esc(p?.name ?? "");
      const share = total > 0 ? `${((p.value / total) * 100).toFixed(1)}%` : "—";
      const rank = sorted.indexOf(p.value) + 1;
      return (
        `<div style="font-weight:600;margin-bottom:2px">${esc(p.name)}</div>` +
        `<div>${esc(formatValue(p.value, config))}</div>` +
        `<div style="opacity:.75;font-size:11px">⁦${share}⁩ من الإجمالي · الترتيب ⁦${rank}⁩ من ⁦${nums.length}⁩</div>`
      );
    },
  };
}

/** يضيف التكبير/التنقل والتلميح الغني للنسخة التفاعلية فقط (لا للتصدير). */
export function withInteraction<T extends Opt>(option: T, config: ChartConfig): T {
  const out: Opt = { ...option };
  const list = out["series"];
  // التركيز: عند تمرير المؤشر على سلسلة تخفت البقية؛ يبقى الرسم مقروءاً مع كثرة السلاسل.
  if (
    Array.isArray(list) &&
    list.length > 1 &&
    ["bar", "horizontalBar", "stacked", "line", "area"].includes(config.kind)
  ) {
    out["series"] = list.map((item) => {
      const it = item as Opt;
      return {
        ...it,
        emphasis: {
          focus: "series",
          blurScope: "coordinateSystem",
          ...((it["emphasis"] as Opt) ?? {}),
        },
      };
    });
  }
  const tip = richTooltip(out, config);
  if (tip) out["tooltip"] = tip;
  if (!isZoomable(out, config)) return out as T;
  const horizontal = config.kind === "horizontalBar";
  const axisKey = horizontal ? "yAxisIndex" : "xAxisIndex";
  const legendBottom = config.legend === "bottom";
  const grid = (out["grid"] as Opt | undefined) ?? {};
  const bottom = typeof grid["bottom"] === "number" ? grid["bottom"] : 24;
  const right = typeof grid["right"] === "number" ? grid["right"] : 16;
  out["grid"] = horizontal ? { ...grid, right: right + 28 } : { ...grid, bottom: bottom + 36 };
  out["dataZoom"] = [
    {
      type: "inside",
      [axisKey]: 0,
      minSpan: ZOOM_MIN_SPAN,
      zoomOnMouseWheel: "ctrl",
      moveOnMouseMove: true,
      preventDefaultMouseMove: false,
    },
    {
      type: "slider",
      [axisKey]: 0,
      minSpan: ZOOM_MIN_SPAN,
      height: horizontal ? undefined : 14,
      width: horizontal ? 14 : undefined,
      bottom: horizontal ? undefined : legendBottom ? 26 : 4,
      right: horizontal ? 4 : undefined,
      showDetail: false,
      brushSelect: false,
      borderColor: "transparent",
      backgroundColor: "rgba(143,160,184,.12)",
      fillerColor: "rgba(96,245,210,.22)",
      handleStyle: { color: "#60F5D2", borderColor: "#60F5D2" },
      showDataShadow: false,
      textStyle: { color: "#8FA0B8" },
    },
  ];
  return out as T;
}
