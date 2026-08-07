/**
 * لوحات القيادة المباشرة: مجموعة ويدجت مخصّصة يبنيها المستخدم وتُحفظ محلياً،
 * ويُعاد حساب كل ويدجت عبر SQL على DuckDB بعد أي تغيير في البيانات.
 */
import { defaultConfig, type ChartConfig } from "@/lib/chart-studio";
import type { TableInfo } from "@/lib/duckdb-service";
import { isNumericType, isDateColumn } from "@/lib/profile";

export type WidgetSize = "sm" | "md" | "lg";

export interface BoardWidget {
  id: string;
  size: WidgetSize;
  config: ChartConfig;
}

export interface Board {
  widgets: BoardWidget[];
}

const STORAGE_PREFIX = "basira.board.";

export function newWidgetId() {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function loadBoard(key: string): Board {
  if (typeof window === "undefined") return { widgets: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return { widgets: [] };
    const parsed = JSON.parse(raw) as Board;
    return Array.isArray(parsed.widgets) ? parsed : { widgets: [] };
  } catch {
    return { widgets: [] };
  }
}

export function saveBoard(key: string, board: Board) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(board));
  } catch {
    /* تجاهل امتلاء التخزين */
  }
}

export function createWidget(info: TableInfo, patch: Partial<ChartConfig> = {}): BoardWidget {
  return {
    id: newWidgetId(),
    size: "md",
    config: { ...defaultConfig(info), ...patch },
  };
}

/** لوحة انطلاق مقترحة تُبنى تلقائياً من أعمدة الملف. */
export function starterBoard(info: TableInfo): BoardWidget[] {
  const numeric = info.schema.filter((c) => isNumericType(c.type));
  const dateCol = info.schema.find((c) => isDateColumn(c.type, c.name));
  const cats = info.schema.filter(
    (c) => !isNumericType(c.type) && !isDateColumn(c.type, c.name),
  );
  const widgets: BoardWidget[] = [];

  if (cats[0]) {
    widgets.push(
      createWidget(info, {
        kind: "bar",
        x: cats[0].name,
        y: numeric[0]?.name ?? cats[0].name,
        agg: numeric[0] ? "SUM" : "COUNT",
        title: `${numeric[0] ? "مجموع" : "عدد"} حسب ${cats[0].name}`,
        limit: 8,
      }),
    );
  }
  if (dateCol) {
    widgets.push(
      createWidget(info, {
        kind: "area",
        x: dateCol.name,
        y: numeric[0]?.name ?? dateCol.name,
        agg: numeric[0] ? "SUM" : "COUNT",
        sort: "label_asc",
        title: `التطور عبر ${dateCol.name}`,
        limit: 20,
      }),
    );
  }
  if (cats[1]) {
    widgets.push(
      createWidget(info, {
        kind: "pie",
        x: cats[1].name,
        y: numeric[0]?.name ?? cats[1].name,
        agg: numeric[0] ? "SUM" : "COUNT",
        title: `التوزيع حسب ${cats[1].name}`,
        limit: 6,
      }),
    );
  }
  if (numeric[1] && cats[0]) {
    widgets.push(
      createWidget(info, {
        kind: "line",
        x: cats[0].name,
        y: numeric[1].name,
        agg: "AVG",
        title: `متوسط ${numeric[1].name} حسب ${cats[0].name}`,
        limit: 10,
      }),
    );
  }
  if (widgets.length === 0 && info.schema[0]) {
    widgets.push(createWidget(info, { title: "نظرة عامة" }));
  }
  return widgets;
}

export const SIZE_CLASS: Record<WidgetSize, string> = {
  sm: "lg:col-span-4",
  md: "lg:col-span-6",
  lg: "lg:col-span-12",
};
