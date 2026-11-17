import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { GUIDES } from "@/lib/guides";
import { guideDates } from "@/lib/guide-dates";

const BASE_URL = "https://basira-data-viewer.lovable.app";

interface SitemapEntry {
  path: string;
  changefreq: "weekly" | "monthly";
  priority: string;
  lastmod?: string;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        // Keep the sitemap in sync with the same source that renders the guide library.
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
            `    <loc>${escapeXml(`${BASE_URL}${entry.path}`)}</loc>`,
            ...(entry.lastmod ? [`    <lastmod>${entry.lastmod}</lastmod>`] : []),
            `    <changefreq>${entry.changefreq}</changefreq>`,
            `    <priority>${entry.priority}</priority>`,
            "  </url>",
          ].join("\n"),
        );

        const xml = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...urls,
          "</urlset>",
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600, s-maxage=3600",
          },
        });
      },
    },
  },
});
