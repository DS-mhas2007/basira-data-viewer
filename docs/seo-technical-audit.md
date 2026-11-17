# MIZYAi — Technical SEO Audit

Last reviewed: 2026-11-17

This document records repository-level checks only. It does not claim that Google has crawled or indexed the URLs, or that field performance metrics have been measured.

## Confirmed in source

| Area | Current implementation | Status |
|---|---|---|
| Canonical URLs | Homepage, guide index, and guide articles use the current `https://basira-data-viewer.lovable.app` origin | Source checked |
| Sitemap | Dynamic `/sitemap.xml` includes the homepage, guide index, and entries from the shared `GUIDES` collection | Source checked |
| Robots | `/robots.txt` allows public crawling, disallows `/auth`, and references the sitemap | Source checked |
| Page metadata | Route-level title and description; Open Graph metadata on homepage and guide pages; Twitter metadata on key landing pages | Source checked |
| Structured data | Organization, WebSite, WebApplication, CollectionPage, BlogPosting, and BreadcrumbList are generated in route metadata | Source checked |
| Internal guide discovery | Guide index and article pages link to related guides and the main tool; the app top bar now exposes a persistent guide-library link, and the empty discovery screen links to the guide library | Source checked |

## Follow-up checks still required

- Request the deployed homepage, guide pages, `/robots.txt`, and `/sitemap.xml` and verify HTTP status codes and rendered HTML.
- Crawl all internal links to detect 404s, redirect chains, and orphaned guide pages.
- Review image alternative text, dimensions, responsive variants, and social preview assets.
- Run Lighthouse against representative mobile and desktop pages. No Lighthouse score is claimed by this source audit.
- Review Core Web Vitals using field data (CrUX/Search Console) when sufficient data is available. No LCP, INP, or CLS measurements are claimed here.
- Validate structured data with Google's Rich Results Test / Schema Markup Validator.
- Review indexing, sitemap processing, and canonical selection in Google Search Console.
- Latest Search Console snapshot (last 28 days, 2026-11-17): guide index sitemap reports 11 submitted URLs, 0 errors and 0 warnings; page-level search data is still sparse (20 impressions, 0 clicks for `/guide/arabic-csv-excel`, average position 5.8).

## Domain policy

Keep the current Lovable domain as the canonical origin until a production domain is selected and configured. A future domain migration must include URL mapping, permanent redirects, updated canonical and sitemap URLs, and Search Console property verification. Do not change canonical URLs before that migration plan is ready.

## Notes

- Keyword targets in `docs/seo-keyword-map.md` are editorial hypotheses, not verified search-volume or ranking data.
- The presence of a sitemap or metadata in source code does not guarantee indexing or ranking.
- Re-check this document after deployment or any route/domain change.
