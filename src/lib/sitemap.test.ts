import { describe, expect, it } from "vitest";
import { GUIDES } from "@/lib/guides";
import { guideDates } from "@/lib/guide-dates";
import { buildSitemapXml, escapeXml, SITEMAP_BASE_URL } from "./sitemap";

describe("XML sitemap", () => {
  it("escapes XML reserved characters in text values", () => {
    expect(escapeXml(`A&B <guide> "quoted" 'single'`)).toBe(
      "A&amp;B &lt;guide&gt; &quot;quoted&quot; &apos;single&apos;",
    );
  });

  it("includes the homepage, guide index, and every registered guide exactly once", () => {
    const xml = buildSitemapXml();
    const locations = [...xml.matchAll(/<loc>(.*?)<\\/loc>/g)].map((match) => match[1]);
    const expected = [
      `${SITEMAP_BASE_URL}/`,
      `${SITEMAP_BASE_URL}/guide`,
      ...GUIDES.map((guide) => `${SITEMAP_BASE_URL}${guide.to}`),
    ];

    expect(locations).toHaveLength(GUIDES.length + 2);
    expect(new Set(locations).size).toBe(locations.length);
    expect(locations).toEqual(expected);
  });

  it("emits valid ISO calendar dates for guide lastmod values", () => {
    const xml = buildSitemapXml();
    const lastmods = [...xml.matchAll(/<lastmod>(.*?)<\\/lastmod>/g)].map((match) => match[1]);

    expect(lastmods).toHaveLength(GUIDES.length);
    for (const guide of GUIDES) {
      const expected = guideDates(guide.to).updated;
      expect(xml).toContain(`<loc>${SITEMAP_BASE_URL}${guide.to}</loc>\\n    <lastmod>${expected}</lastmod>`);
      expect(expected).toMatch(/^\\d{4}-\\d{2}-\\d{2}$/);
      expect(new Date(`${expected}T00:00:00.000Z`).toISOString().slice(0, 10)).toBe(expected);
    }
  });

  it("uses the standard sitemap namespace and XML declaration", () => {
    const xml = buildSitemapXml();
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml.endsWith("</urlset>")).toBe(true);
  });
});
