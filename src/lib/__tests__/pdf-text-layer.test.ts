// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseFontMetrics, toVisualOrder } from "../pdf-text-layer";

describe("pdf text layer", () => {
  it("reads real advance widths from the report font (matches /W in the PDF)", () => {
    const buf = readFileSync("public/fonts/Changa-Variable.ttf");
    const m = parseFontMetrics(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    expect(m.unitsPerEm).toBe(1000);
    expect(m.advance("ا".codePointAt(0)!)).toBe(280);
    expect(m.advance("ل".codePointAt(0)!)).toBe(663);
    expect(m.advance(32)).toBe(250);
  });

  it("stores Arabic in visual order and keeps Latin/number runs intact", () => {
    expect(toVisualOrder("employees.csv")).toBe("employees.csv");
    expect(toVisualOrder("كلمة")).toBe("ةملك");
    // الجملة: ترتيب المقاطع معكوس، والمقطع اللاتيني سليم
    expect(toVisualOrder("ملف employees.csv جاهز")).toBe("زهاج employees.csv فلم");
  });
});
