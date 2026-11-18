import { describe, expect, it } from "vitest";
import { GUIDE_TOOL_LINKS, getGuideToolLink, readGuideToolIntent } from "./guide-tools";
import { GUIDES } from "./guides";

describe("guide tool destinations", () => {
  it("provides a contextual workspace destination for every published guide", () => {
    expect(Object.keys(GUIDE_TOOL_LINKS)).toHaveLength(GUIDES.length);
    expect(GUIDES.every((guide) => GUIDE_TOOL_LINKS[guide.to])).toBe(true);
    for (const pathname of Object.keys(GUIDE_TOOL_LINKS)) {
      const link = getGuideToolLink(pathname);
      expect(link?.href).toContain(`tool=${GUIDE_TOOL_LINKS[pathname]!.tool}`);
      expect(link?.label.length).toBeGreaterThan(5);
    }
  });

  it("encodes an initial question for Ask MIZYAi guides", () => {
    const link = getGuideToolLink("/guide/sql-basics");
    if (!link) throw new Error("Expected a guide link for /guide/sql-basics");
    const intent = readGuideToolIntent(link.href.slice(1));
    expect(intent?.tool).toBe("ask");
    expect(intent?.prompt).toContain("SQL");
  });

  it("ignores unknown or malformed tool intents", () => {
    expect(readGuideToolIntent("?tool=drop-database")).toBeNull();
    expect(readGuideToolIntent("?prompt=hello")).toBeNull();
  });

  it("supports workspace tool links without requiring a prompt", () => {
    expect(readGuideToolIntent("?tool=quality")).toEqual({ tool: "quality" });
  });
});
