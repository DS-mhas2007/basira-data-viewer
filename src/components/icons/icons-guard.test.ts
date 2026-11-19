import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("icon set", () => {
  it("uses only @/components/icons (no direct lucide-react imports)", () => {
    const offenders = walk("src")
      .filter((f) => !f.endsWith("icons-guard.test.ts"))
      .filter((f) => /from\s+["']lucide-react["']/.test(readFileSync(f, "utf8")));
    expect(offenders, `استورد الأيقونات من "@/components/icons" بدل lucide-react:\n${offenders.join("\n")}`).toEqual([]);
  });
});
