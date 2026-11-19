import { GUIDES } from "@/lib/guides";
import { guideDates } from "@/lib/guide-dates";

export const SITEMAP_BASE_URL = "https://basira-data-viewer.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq: "weekly" | "monthly";
  priority: string;
  lastmod?: string;
}

/** Escape values inserted into XML text nodes. */
export function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

/** Build the public sitemap from the same guide registry used by the guide library. */
export function buildSitemapXml(): string {
  const entries: SitemapEntry[] = [
    { path: "/", changefreq: "weekly", priority: "1.0" },
    { path: "/guide", changefreq: "weekly", priority: "0.9" },
    ...GUIDES.map((guide) => ({
      path: guide.to,
      changefreq: "monthly" as const,
      priority: "0.8",
      lastmod: guideDates(guide.to).updated,
    })),
  ];

  const urls = entries.map((entry) =>
    [
      "  <url>",
      `    <loc>${escapeXml(`${SITEMAP_BASE_URL}${entry.path}`)}</loc>`,
      ...(entry.lastmod ? [`    <lastmod>${entry.lastmod}</lastmod>`] : []),
      `    <changefreq>${entry.changefreq}</changefreq>`,
      `    <priority>${entry.priority}</priority>`,
      "  </url>",
    ].join("\n"),
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
  ].join("\n");
}
