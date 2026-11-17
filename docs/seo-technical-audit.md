# MIZYAi — Technical SEO Audit

Last reviewed: 2026-11-17

This document records repository-level checks only. It does not claim that Google has crawled or indexed the URLs, or that field performance metrics have been measured.

## Confirmed in source

| Area | Current implementation | Status |
|---|---|---|
| Canonical URLs | Homepage, guide index, and guide articles use the current `https://basira-data-viewer.lovable.app` origin | Source checked |
| Sitemap | Dynamic `/sitemap.xml` includes the homepage, guide index, and all 20 guide entries from the shared `GUIDES` collection (22 source URLs total) | Source checked |
| Robots | `/robots.txt` allows public crawling, disallows `/auth`, and references the sitemap | Source checked |
| Page metadata | Route-level title and description; Open Graph metadata on homepage and guide pages; Twitter metadata on key landing pages | Source checked |
| Structured data | Organization, WebSite, WebApplication, CollectionPage, BlogPosting, and BreadcrumbList are generated in route metadata | Source checked |
| Internal guide discovery | Searchable guide library now contains 20 guides across four categories; article-to-article contextual links connect import, cleaning, descriptive and advanced analysis, SQL and privacy topics; the app top bar and discovery screen link to the library | Source checked |

## Follow-up checks still required

- Request the deployed homepage, guide pages, `/robots.txt`, and `/sitemap.xml` and verify HTTP status codes and rendered HTML.
- Crawl all internal links to detect 404s, redirect chains, and orphaned guide pages.
- Review image alternative text, dimensions, responsive variants, and social preview assets.
- Run Lighthouse against representative mobile and desktop pages. No Lighthouse score is claimed by this source audit.
- Review Core Web Vitals using field data (CrUX/Search Console) when sufficient data is available. No LCP, INP, or CLS measurements are claimed here.
- Validate structured data with Google's Rich Results Test / Schema Markup Validator.
- Review indexing, sitemap processing, and canonical selection in Google Search Console.
- Latest Search Console snapshot (last 28 days, checked 2026-11-17): page-level data shows 21 impressions and 0 clicks (20 impressions for `/guide/arabic-csv-excel`, average position 5.8; 1 for the homepage). Device split: 14 desktop and 7 mobile impressions. Country rows were sparse: Saudi Arabia 6, Syria 3, Egypt 2, Algeria 2 and eight other countries with one impression each; do not overfit country strategy to this sample. Only one query row was visible (`ملف csv عربي`, 1 impression); low-volume queries may be suppressed. The sitemap report shows 11 submitted URLs, 0 errors and 0 warnings, last downloaded 2026-11-14. This Search Console snapshot predates deployment and recrawling of the six newly added guide URLs; verify the updated sitemap after publication.

## Domain policy

Keep the current Lovable domain as the canonical origin until a production domain is selected and configured. A future domain migration must include URL mapping, permanent redirects, updated canonical and sitemap URLs, and Search Console property verification. Do not change canonical URLs before that migration plan is ready.

## Notes

- Keyword targets in `docs/seo-keyword-map.md` are editorial hypotheses, not verified search-volume or ranking data.
- The presence of a sitemap or metadata in source code does not guarantee indexing or ranking.
- Re-check this document after deployment or any route/domain change.
