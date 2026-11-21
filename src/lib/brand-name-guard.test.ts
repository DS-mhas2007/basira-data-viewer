// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_NAME } from "./constants";

/** يمنع عودة الاسم القديم «بصيرة» إلى نصوص الواجهة والمانيفست والتثبيت. */
describe("brand name", () => {
  it("uses MIZYAi in app constants and the web manifest", () => {
    expect(APP_NAME).toBe("MIZYAi");
    const manifest = JSON.parse(readFileSync("public/manifest.webmanifest", "utf8")) as {
      name: string;
      short_name: string;
    };
    expect(manifest.name).toContain("MIZYAi");
    expect(manifest.short_name).toBe("MIZYAi");
  });

  it.each(["src/lib/pwa.ts", "src/lib/workspace-store.ts", "src/lib/finding-card.ts", "src/lib/chart-studio.ts"])(
    "%s has no user-facing old brand name",
    (file) => {
      expect(readFileSync(file, "utf8")).not.toMatch(/بصيرة|"Basira"/);
    },
  );
});
