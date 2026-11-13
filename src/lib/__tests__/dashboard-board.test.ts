import { describe, expect, it } from "vitest";
import {
  CANVAS_GRID_COLUMNS,
  CANVAS_SCHEMA_VERSION,
  defaultGridLayout,
  migrateBoard,
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
      { x: 0, y: 8, w: 6, h: 8 },
      { x: 0, y: 16, w: 12, h: 8 },
    ]);
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
