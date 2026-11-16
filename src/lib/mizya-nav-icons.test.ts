import { describe, expect, it } from "vitest";
import { mizyaNavGlyph } from "@/lib/mizya-nav-icons";

describe("navigation glyph mapping", () => {
  it("maps existing navigation IDs to their semantic glyphs", () => {
    expect(mizyaNavGlyph("home")).toBe("dashboard");
    expect(mizyaNavGlyph("data")).toBe("database");
    expect(mizyaNavGlyph("analysis")).toBe("analytics");
    expect(mizyaNavGlyph("ask")).toBe("assistant");
    expect(mizyaNavGlyph("insights")).toBe("insights");
    expect(mizyaNavGlyph("quality")).toBe("quality");
    expect(mizyaNavGlyph("reports")).toBe("reports");
  });

  it("leaves unmapped sections on the original icon fallback", () => {
    expect(mizyaNavGlyph("templates")).toBeUndefined();
    expect(mizyaNavGlyph("unknown")).toBeUndefined();
    expect(mizyaNavGlyph("constructor")).toBeUndefined();
  });
});
