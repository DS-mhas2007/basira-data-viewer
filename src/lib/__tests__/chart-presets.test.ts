import { beforeEach, describe, expect, it } from "vitest";
import {
  applyPreset,
  deletePreset,
  loadPresets,
  parsePresets,
  pickStyle,
  savePreset,
  MAX_PRESETS,
} from "@/lib/chart-presets";
import type { ChartConfig } from "@/lib/chart-studio";

const cfg = {
  kind: "bar",
  x: "a",
  y: "b",
  agg: "SUM",
  sort: "value_desc",
  limit: 5,
  title: "T",
  palette: "emerald",
  colors: ["#112233"],
  grid: false,
  legend: "bottom",
} as unknown as ChartConfig;

beforeEach(() => window.localStorage.clear());

describe("chart presets", () => {
  it("style excludes data fields", () => {
    const s = pickStyle(cfg) as Record<string, unknown>;
    expect(s["x"]).toBeUndefined();
    expect(s["title"]).toBeUndefined();
    expect(s["grid"]).toBe(false);
  });
  it("apply keeps columns, aggregation and title", () => {
    const base = { ...cfg, x: "q", y: "w", title: "Mine", grid: true } as ChartConfig;
    const r = applyPreset(base, { id: "1", name: "n", style: pickStyle(cfg) });
    expect(r.x).toBe("q");
    expect(r.title).toBe("Mine");
    expect(r.grid).toBe(false);
  });
  it("saves, replaces by name, deletes", () => {
    const a = savePreset("نمطي", cfg);
    expect(a.ok && a.presets).toHaveLength(1);
    const b = savePreset("نمطي", { ...cfg, grid: true } as ChartConfig);
    expect(b.ok && b.presets).toHaveLength(1);
    expect(loadPresets()[0]!.style.grid).toBe(true);
    expect(deletePreset(loadPresets()[0]!.id)).toHaveLength(0);
  });
  it("rejects empty name and enforces cap", () => {
    expect(savePreset("  ", cfg).ok).toBe(false);
    for (let i = 0; i < MAX_PRESETS; i++) savePreset(`p${i}`, cfg);
    expect(savePreset("extra", cfg).ok).toBe(false);
  });
  it("ignores corrupt or hostile storage", () => {
    expect(parsePresets("not json")).toEqual([]);
    expect(
      parsePresets(
        JSON.stringify([{ id: "1", name: "x", style: { agg: "DROP", limit: 99999 } }, { id: 2 }]),
      ),
    ).toEqual([]);
  });
});
