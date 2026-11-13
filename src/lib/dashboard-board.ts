/**
 * لوحات القيادة المباشرة: مجموعة ويدجت مخصّصة يبنيها المستخدم وتُحفظ محلياً،
 * ويُعاد حساب كل ويدجت عبر SQL على DuckDB بعد أي تغيير في البيانات.
 *
 * Canvas schema v1 adds a stable 12-column layout while preserving the legacy
 * size field so the existing dashboard renderer remains backward compatible.
 */
import { defaultConfig, type ChartConfig } from "@/lib/chart-studio";
import { isIdName, measureScore } from "@/lib/templates";
import type { TableInfo } from "@/lib/duckdb-service";
import { isNumericType, isDateColumn } from "@/lib/profile";

export type WidgetSize = "sm" | "md" | "lg";

export interface GridWidgetLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BoardWidget {
  id: string;
  size: WidgetSize;
  /** Optional only at the input boundary; loadBoard/saveBoard normalize it. */
  layout?: GridWidgetLayout;
  config: ChartConfig;
}

export interface Board {
  schemaVersion?: 1;
  widgets: BoardWidget[];
}

export const CANVAS_SCHEMA_VERSION = 1 as const;
export const CANVAS_GRID_COLUMNS = 12;
const STORAGE_PREFIX = "basira.board.";
const BACKUP_PREFIX = "basira.board.backup.";

const SIZE_WIDTH: Record<WidgetSize, number> = { sm: 4, md: 6, lg: 12 };

function isValidLayout(value: unknown): value is GridWidgetLayout {
  if (!value || typeof value !== "object") return false;
  const layout = value as Partial<GridWidgetLayout>;
  return (
    Number.isInteger(layout.x) &&
    Number.isInteger(layout.y) &&
    Number.isInteger(layout.w) &&
    Number.isInteger(layout.h) &&
    layout.x! >= 0 &&
    layout.y! >= 0 &&
    layout.w! > 0 &&
    layout.h! > 0 &&
    layout.x! + layout.w! <= CANVAS_GRID_COLUMNS
  );
}

/** Deterministic, non-overlapping placement for legacy cards without geometry. */
export function defaultGridLayout(size: WidgetSize, index: number): GridWidgetLayout {
  const w = SIZE_WIDTH[size];
  const perRow = Math.max(1, Math.floor(CANVAS_GRID_COLUMNS / w));
  const column = index % perRow;
  return { x: column * w, y: Math.floor(index / perRow) * 8, w, h: 8 };
}

function findAvailableGridLayout(
  size: WidgetSize,
  occupied: GridWidgetLayout[],
): GridWidgetLayout {
  const w = SIZE_WIDTH[size];
  const h = 8;
  for (let y = 0; ; y += 1) {
    for (let x = 0; x <= CANVAS_GRID_COLUMNS - w; x += 1) {
      const candidate = { x, y, w, h };
      const overlaps = occupied.some(
        (item) =>
          candidate.x < item.x + item.w &&
          candidate.x + candidate.w > item.x &&
          candidate.y < item.y + item.h &&
          candidate.y + candidate.h > item.y,
      );
      if (!overlaps) return candidate;
    }
  }
}

/** Recomputes a collision-free row-major layout after reorder or resize. */
export function reflowBoard<T extends Pick<BoardWidget, "size">>(
  widgets: T[],
): (T & { layout: GridWidgetLayout })[] {
  const occupied: GridWidgetLayout[] = [];
  return widgets.map((widget) => {
    const layout = findAvailableGridLayout(widget.size, occupied);
    occupied.push(layout);
    return { ...widget, layout };
  });
}

/** Converts legacy { widgets } boards to the versioned Canvas document. */
export function migrateBoard(input: unknown): Board {
  if (!input || typeof input !== "object") return { schemaVersion: CANVAS_SCHEMA_VERSION, widgets: [] };
  const candidate = input as { widgets?: unknown };
  if (!Array.isArray(candidate.widgets)) {
    return { schemaVersion: CANVAS_SCHEMA_VERSION, widgets: [] };
  }

  const occupied: GridWidgetLayout[] = [];
  const seenIds = new Set<string>();
  const widgets: BoardWidget[] = [];

  candidate.widgets.forEach((raw, index) => {
    // Ignore malformed entries instead of allowing one corrupt card to break the whole Canvas.
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
    const widget = raw as Partial<BoardWidget>;
    if (!widget.config || typeof widget.config !== "object" || Array.isArray(widget.config)) return;

    const baseId = typeof widget.id === "string" && widget.id.trim()
      ? widget.id.trim()
      : `widget-${index + 1}`;
    let id = baseId;
    let suffix = 2;
    while (seenIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    seenIds.add(id);

    const size: WidgetSize =
      widget.size === "sm" || widget.size === "lg" ? widget.size : "md";
    // Keep stored geometry only when it is valid and collision-free.
    // Older Canvas versions could persist individually valid but overlapping cards.
    const storedLayout = isValidLayout(widget.layout) ? widget.layout : null;
    const overlapsExisting = storedLayout
      ? occupied.some(
          (item) =>
            storedLayout.x < item.x + item.w &&
            storedLayout.x + storedLayout.w > item.x &&
            storedLayout.y < item.y + item.h &&
            storedLayout.y + storedLayout.h > item.y,
        )
      : false;
    const layout =
      storedLayout && !overlapsExisting
        ? storedLayout
        : findAvailableGridLayout(size, occupied);
    occupied.push(layout);
    const config = widget.config as ChartConfig;
    // Legacy stacked charts had one aggregate series, so they were not truly stacked.
    // Normalize them to regular bars rather than preserving a misleading chart type.
    const normalizedConfig = config.kind === "stacked" ? { ...config, kind: "bar" as const } : config;
    widgets.push({ ...widget, id, size, config: normalizedConfig, layout });
  });

  return { schemaVersion: CANVAS_SCHEMA_VERSION, widgets };
}

export function newWidgetId() {
  return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function loadBoard(key: string): Board {
  if (typeof window === "undefined") {
    return { schemaVersion: CANVAS_SCHEMA_VERSION, widgets: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return { schemaVersion: CANVAS_SCHEMA_VERSION, widgets: [] };
    return migrateBoard(JSON.parse(raw));
  } catch {
    return { schemaVersion: CANVAS_SCHEMA_VERSION, widgets: [] };
  }
}

/**
 * Persists a normalized v1 document. Before the first legacy migration, keep
 * the original payload under a separate backup key so users can recover it.
 * Returns false when browser storage is unavailable or quota-limited.
 */
export function saveBoard(key: string, board: Board): boolean {
  if (typeof window === "undefined") return false;
  try {
    const storageKey = STORAGE_PREFIX + key;
    const backupKey = BACKUP_PREFIX + key;
    const existing = window.localStorage.getItem(storageKey);
    if (existing && !window.localStorage.getItem(backupKey)) {
      let existingVersion: unknown;
      try {
        existingVersion = (JSON.parse(existing) as { schemaVersion?: unknown }).schemaVersion;
      } catch {
        existingVersion = undefined;
      }
      if (existingVersion !== CANVAS_SCHEMA_VERSION) {
        window.localStorage.setItem(backupKey, existing);
      }
    }
    const normalized = migrateBoard(board);
    window.localStorage.setItem(storageKey, JSON.stringify(normalized));
    return true;
  } catch {
    return false;
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
  // المقاييس: أرقام ليست معرّفات ولا تواريخ، مرتبة (إجمالي مالي > سعر > غيره > كميات) مع ثبات الترتيب
  const numeric = info.schema
    .filter((c) => isNumericType(c.type) && !isDateColumn(c.type, c.name) && !isIdName(c.name))
    .map((c, i) => ({ c, i }))
    .sort((a, b) => measureScore(b.c.name) - measureScore(a.c.name) || a.i - b.i)
    .map((x) => x.c);
  const dateCol = info.schema.find((c) => isDateColumn(c.type, c.name));
  const cats = info.schema.filter(
    (c) => !isNumericType(c.type) && !isDateColumn(c.type, c.name) && !isIdName(c.name),
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
        // كل النقاط: الحد مع الترتيب التصاعدي كان يعرض أول 20 تاريخاً فقط وكأنها الاتجاه الكامل
        limit: 0,
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
        kind: "bar",
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
