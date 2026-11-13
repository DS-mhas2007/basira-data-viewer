import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CANVAS_GRID_COLUMNS,
  CANVAS_SCHEMA_VERSION,
  defaultGridLayout,
  migrateBoard,
  loadBoard,
  reflowBoard,
  saveBoard,
} from "../dashboard-board";

describe("Canvas board migration", () => {
  it("upgrades a legacy board and derives stable geometry from card sizes", () => {
    const migrated = migrateBoard({
      widgets: [
        { id: "small", size: "sm", config: { title: "Small" } },
        { id: "medium", size: "md", config: { title: "Medium" } },
        { id: "large", size: "lg", config: { title: "Large" } },
      ],
    });

    expect(migrated.schemaVersion).toBe(CANVAS_SCHEMA_VERSION);
    expect(migrated.widgets.map((widget) => widget.layout)).toEqual([
      { x: 0, y: 0, w: 4, h: 8 },
      { x: 4, y: 0, w: 6, h: 8 },
      { x: 0, y: 8, w: 12, h: 8 },
    ]);
  });

  it("packs mixed legacy sizes without introducing overlaps", () => {
    const migrated = migrateBoard({
      widgets: [
        { id: "wide-a", size: "md", config: { title: "A" } },
        { id: "wide-b", size: "md", config: { title: "B" } },
        { id: "narrow", size: "sm", config: { title: "C" } },
      ],
    });
    const [a, b, c] = migrated.widgets.map((widget) => widget.layout!);
    expect(a).toEqual({ x: 0, y: 0, w: 6, h: 8 });
    expect(b).toEqual({ x: 6, y: 0, w: 6, h: 8 });
    expect(c).toEqual({ x: 0, y: 8, w: 4, h: 8 });
  });

  it("reflows widgets after drag reorder or resize without overlaps", () => {
    const widgets = [
      { id: "a", size: "md" as const, config: { title: "A" } },
      { id: "b", size: "md" as const, config: { title: "B" } },
      { id: "c", size: "sm" as const, config: { title: "C" } },
    ];
    const [first, second, third] = reflowBoard([widgets[2]!, widgets[0]!, widgets[1]!]);
    expect(first?.layout).toEqual({ x: 0, y: 0, w: 4, h: 8 });
    expect(second?.layout).toEqual({ x: 4, y: 0, w: 6, h: 8 });
    expect(third?.layout).toEqual({ x: 0, y: 8, w: 6, h: 8 });
  });

  it("migrates legacy single-series stacked charts to regular bars without losing settings", () => {
    const migrated = migrateBoard({
      widgets: [{
        id: "legacy-stacked",
        size: "md",
        config: { kind: "stacked", title: "Legacy stacked", palette: "basira", dataLabels: true },
      }],
    });

    expect(migrated.widgets[0]?.config).toMatchObject({
      kind: "bar",
      title: "Legacy stacked",
      palette: "basira",
      dataLabels: true,
    });
  });

  it("preserves valid layouts already stored in a versioned board", () => {
    const layout = { x: 3, y: 5, w: 6, h: 10 };
    const migrated = migrateBoard({
      schemaVersion: CANVAS_SCHEMA_VERSION,
      widgets: [{ id: "kept", size: "md", layout, config: { title: "Kept" } }],
    });

    expect(migrated.widgets[0]?.layout).toEqual(layout);
  });

  it("repairs invalid geometry without changing the widget identity or config", () => {
    const config = { title: "Recover me" };
    const migrated = migrateBoard({
      widgets: [{ id: "broken", size: "md", layout: { x: 10, y: 0, w: 6, h: 8 }, config }],
    });

    expect(migrated.widgets[0]).toMatchObject({
      id: "broken",
      config,
      layout: { x: 0, y: 0, w: 6, h: 8 },
    });
  });

  it("repairs overlapping stored layouts while preserving the first valid position", () => {
    const migrated = migrateBoard({
      schemaVersion: CANVAS_SCHEMA_VERSION,
      widgets: [
        { id: "first", size: "md", layout: { x: 0, y: 0, w: 6, h: 8 }, config: { title: "First" } },
        { id: "overlap", size: "md", layout: { x: 3, y: 2, w: 6, h: 8 }, config: { title: "Overlap" } },
      ],
    });

    expect(migrated.widgets[0]?.layout).toEqual({ x: 0, y: 0, w: 6, h: 8 });
    expect(migrated.widgets[1]?.layout).toEqual({ x: 6, y: 0, w: 6, h: 8 });
  });

  it("skips malformed widget entries and repairs missing or duplicate IDs", () => {
    const migrated = migrateBoard({
      widgets: [
        { id: "duplicate", size: "sm", config: { title: "First" } },
        null,
        { id: "duplicate", size: "md", config: { title: "Second" } },
        { id: "missing-config" },
        { size: "lg", config: { title: "Third" } },
      ],
    });

    expect(migrated.widgets).toHaveLength(3);
    expect(migrated.widgets.map((widget) => widget.id)).toEqual([
      "duplicate",
      "duplicate-2",
      "widget-5",
    ]);
    expect(new Set(migrated.widgets.map((widget) => widget.id)).size).toBe(3);
    expect(migrated.widgets.map((widget) => widget.config.title)).toEqual([
      "First",
      "Second",
      "Third",
    ]);
  });

  it("returns a valid empty document for malformed input", () => {
    expect(migrateBoard(null)).toEqual({
      schemaVersion: CANVAS_SCHEMA_VERSION,
      widgets: [],
    });
    expect(migrateBoard({ widgets: "not-an-array" })).toEqual({
      schemaVersion: CANVAS_SCHEMA_VERSION,
      widgets: [],
    });
  });

  it("keeps every default layout within the 12-column grid", () => {
    for (const size of ["sm", "md", "lg"] as const) {
      for (let index = 0; index < 20; index += 1) {
        const layout = defaultGridLayout(size, index);
        expect(layout.x).toBeGreaterThanOrEqual(0);
        expect(layout.x + layout.w).toBeLessThanOrEqual(CANVAS_GRID_COLUMNS);
        expect(layout.w).toBeGreaterThan(0);
        expect(layout.h).toBeGreaterThan(0);
      }
    }
  });
});


describe("Canvas local persistence", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("saves a versioned board and preserves the pre-migration payload once", () => {
    const legacy = JSON.stringify({
      widgets: [{ id: "legacy", size: "sm", config: { title: "Legacy" } }],
    });
    window.localStorage.setItem("basira.board.analytics", legacy);

    const saved = saveBoard("analytics", {
      widgets: [{ id: "current", size: "md", config: { title: "Current" } } as never],
    });

    expect(saved).toBe(true);
    expect(window.localStorage.getItem("basira.board.backup.analytics")).toBe(legacy);
    expect(JSON.parse(window.localStorage.getItem("basira.board.analytics") ?? "{}")).toMatchObject({
      schemaVersion: CANVAS_SCHEMA_VERSION,
      widgets: [{ id: "current", layout: { x: 0, y: 0, w: 6, h: 8 } }],
    });
  });

  it("loads malformed storage as an empty, versioned board", () => {
    window.localStorage.setItem("basira.board.broken", "{not-json");

    expect(loadBoard("broken")).toEqual({
      schemaVersion: CANVAS_SCHEMA_VERSION,
      widgets: [],
    });
  });

  it("reports a failed local write instead of claiming the board was saved", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota-exceeded");
    });

    expect(
      saveBoard("quota", {
        widgets: [{ id: "widget", size: "md", config: { title: "Widget" } } as never],
      }),
    ).toBe(false);
  });
});
