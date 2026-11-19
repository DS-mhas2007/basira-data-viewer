# MIZYAi — Technical SEO Audit

Last reviewed: 2026-11-19

This document records repository-level checks and a Google Search Console snapshot. Source inspection does not prove that Google has crawled or indexed the URLs.

## Confirmed in source

| Area | Current implementation | Status |
|---|---|---|
| Canonical URLs | Homepage, guide index, and guide articles use `https://basira-data-viewer.lovable.app` | Source checked |
| Sitemap | Dynamic `/sitemap.xml` includes homepage, guide index, and all 22 entries from shared `GUIDES` (24 source URLs total) | Source checked |
| Robots | Static `public/robots.txt` allows public crawling, disallows `/auth`, and references the sitemap | Source checked |
| Page metadata | Homepage, guide index, and article routes define route-level title and description; OG/Twitter metadata is present on reviewed routes | Source checked |
| Structured data | Organization, WebSite, WebApplication, CollectionPage/ItemList, BlogPosting, and BreadcrumbList are generated in route metadata | Source checked |
| Internal guide discovery | Shared guide library contains 22 guides across four categories | Source checked |
| Guide-to-tool journeys | Guide pages and workspace navigation contain contextual links; route-by-route live validation remains pending | Source checked; runtime not verified |

## Search Console snapshot

Property: `https://basira-data-viewer.lovable.app/`  
Window: 2026-10-22 to 2026-11-18.

- Site-level daily export: 20 impressions, 0 clicks, 0% CTR.
- One page row returned: `/guide/arabic-csv-excel`, 20 impressions, average position 6.05.
- One visible query row: `ملف csv عربي`, 1 impression, average position 6, 0 clicks.
- Query rows may omit anonymized/low-volume queries and must not be treated as a complete site total.
- Sitemap table: 24 submitted URLs, 0 errors, 0 warnings; last submitted/downloaded 18 Nov 2026.
- Submitted URLs are not indexed-URL counts. This data does not establish how many URLs are indexed.

## Findings and follow-up

- Verify `guideDates` defaults against real content changes. The current default `dateModified` and sitemap `lastmod` is 2026-11-17, with explicit 2026-11-18 overrides for two guides. A shared date is acceptable only if it accurately reflects meaningful updates.
- Fetch the deployed homepage, representative guide pages, `/robots.txt`, and `/sitemap.xml`; confirm status codes, redirects, content types, server-rendered metadata and XML validity. These live HTTP checks were not completed in this audit environment.
- Crawl all 22 guide routes and internal links for 404s, redirect chains, canonical mismatches and orphaned pages.
- Review image alternative text, dimensions, responsive variants and social preview assets.
- Run Lighthouse on representative mobile and desktop pages. No Lighthouse score is claimed.
- Review Page Indexing and URL Inspection in Search Console. Sitemap processing does not prove indexing.
- Review Core Web Vitals using field data when sufficient data is available. No LCP, INP or CLS measurements are claimed.

## Domain policy

Keep the current Lovable domain as canonical until a production MIZYA domain is selected and configured. A future migration must include URL mapping, permanent redirects, updated canonical and sitemap URLs, and Search Console property verification. Do not change canonical URLs before that migration plan is ready.

## Notes

- `docs/seo-keyword-map.md` contains editorial hypotheses, not verified search-volume or difficulty measurements.
- Do not rewrite all titles or publish bulk content based on the current small Search Console sample.
- Re-check this document after deployment or any route/domain change.
