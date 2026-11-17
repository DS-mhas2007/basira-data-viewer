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
- Latest Search Console snapshot (18 Oct–14 Nov 2026, checked 17 Nov): page-level data shows 25 impressions and 0 clicks (24 impressions for `/guide/arabic-csv-excel`, average position 6.08; 1 for the homepage, position 1). Device split: 17 desktop and 8 mobile impressions. Country rows: Saudi Arabia 8, Syria 4, Egypt 3, Algeria 2, and eight other countries with one impression each. Only one query row was visible (`ملف csv عربي`, 1 impression at position 6); low-volume queries may be suppressed. The sitemap report shows 11 submitted URLs, 0 errors and 0 warnings, last downloaded 14 Nov. The current source sitemap contains 22 URLs (homepage, guide index and 20 guides), so recheck its processing after Google fetches the six guides published on 17 Nov. The submitted count is not an indexed-URL count. Windsor trial access currently limits history to the last 30 days.

## Domain policy

Keep the current Lovable domain as the canonical origin until a production domain is selected and configured. A future domain migration must include URL mapping, permanent redirects, updated canonical and sitemap URLs, and Search Console property verification. Do not change canonical URLs before that migration plan is ready.

## Notes

- Keyword targets in `docs/seo-keyword-map.md` are editorial hypotheses, not verified search-volume or ranking data.
- The presence of a sitemap or metadata in source code does not guarantee indexing or ranking.
- Re-check this document after deployment or any route/domain change.
