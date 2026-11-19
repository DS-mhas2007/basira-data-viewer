# MIZYAi — SEO Sprint 01: Technical audit

Audit date: 2026-11-19  
Branch: `chore/seo-sprint-01-audit`  
Scope: repository source review + Google Search Console snapshot. No production code or deployment changes were made.

## Executive summary

The repository has a coherent baseline for Arabic-language SEO: route-level metadata, canonical URLs, structured data, a shared guide registry, a generated sitemap, and a static robots.txt. The current Search Console sample is still very small and does not justify broad title rewrites or publishing large volumes of new content.

## Search Console snapshot

Property: `https://basira-data-viewer.lovable.app/`  
Window: 2026-10-22 through 2026-11-18 (latest 28-day window requested; daily export returned 27 populated date rows).

| Metric | Observed value |
|---|---:|
| Site-level impressions (sum of daily rows) | 20 |
| Clicks | 0 |
| CTR | 0% |
| Page rows returned | 1 |
| Top returned page | `/guide/arabic-csv-excel` |
| Impressions for that page | 20 |
| Average position for that page | 6.05 |
| Visible query rows | 1 |
| Visible query | `ملف csv عربي` |
| Impressions for visible query | 1 |
| Average position for visible query | 6 |

Search Console can omit anonymized or low-volume queries. Query rows must not be summed and treated as the site's impression total. The lack of a returned row for another page is not proof that it is not indexed.

### Sitemap processing

The Search Console sitemap table returned:

- Sitemap: `https://basira-data-viewer.lovable.app/sitemap.xml`
- Submitted URLs: 24
- Errors: 0
- Warnings: 0
- Last submitted: 2026-11-18
- Last downloaded: 2026-11-18

Submitted URLs are not an indexed-URL count. The connector data does not establish the number of indexed pages.

## Source review — confirmed

| Area | Finding | Status |
|---|---|---|
| Homepage metadata | Arabic title and description are defined in the root route | Confirmed in source |
| Guide index | Unique title/description, canonical, CollectionPage + ItemList data | Confirmed in source |
| Guide articles | Sample article includes title, description, OG/Twitter metadata, canonical, BlogPosting and BreadcrumbList | Confirmed in source |
| Site identity | Organization and WebSite JSON-LD graph is injected from the root route | Confirmed in source |
| Homepage app schema | WebApplication JSON-LD is defined on the homepage | Confirmed in source |
| Canonical origin | Homepage, guides, schema, sitemap and robots reference the Lovable origin | Confirmed in source |
| Sitemap generation | Homepage + guide index + 22 entries from shared `GUIDES` registry = 24 source URLs | Confirmed in source |
| Robots | Static `public/robots.txt` allows public crawling, disallows `/auth`, and references sitemap | Confirmed in source |
| Guide discovery | Shared registry groups 22 guides into four categories and the guide index links to them | Confirmed in source |

## Findings and risks

### P1 — Verify article modification dates used by sitemap

`src/lib/guide-dates.ts` supplies `2026-11-17` as the default `dateModified` and sitemap `lastmod` for paths without an explicit override; two guide paths have an explicit 2026-11-18 override. This shared default is not automatically wrong, but it must reflect real content changes. Compare it against Git history/content updates before changing it. Do not set `lastmod` to the build or deployment date.

### P1 — Confirm canonical domain strategy before any hostname change

The current canonical origin is consistently `https://basira-data-viewer.lovable.app`. Keep it unchanged until the production MIZYA domain is selected, configured, verified, and supported by a complete 301 URL map. Do not mix hostnames in canonical tags, schema, robots, or sitemap.

### P1 — Validate deployed responses

This audit inspected source only. Live HTTP response checks for homepage, representative guide, `/robots.txt`, and `/sitemap.xml` were not completed in this execution environment. Verify status codes, redirects, content types, server-rendered metadata, and XML validity after deployment.

### P1 — Establish actual index coverage

The sitemap report confirms processing, not indexing. Use Search Console Page Indexing and URL Inspection on the homepage, guide index, the CSV guide, and a representative sample of newer guides. Record Google-selected canonical and indexing reason.

### P2 — Improve click-through only after reviewing the actual snippet

The CSV guide is the only returned page row in the current window: 20 impressions, zero clicks, average position 6.05. Review the exact live title, description, and search appearance before testing a narrowly targeted snippet improvement. Do not infer a CTR problem from one query row or rewrite all guide titles.

### P2 — Performance and image validation remain unmeasured

No Lighthouse, CrUX, Core Web Vitals, image-alt, or social-image fetch measurements are claimed by this source audit. Run mobile and desktop checks separately.

## Recommended verification checklist

- [ ] Fetch homepage and representative guide; confirm HTTP 200 and server-rendered title, description, canonical, H1 and JSON-LD.
- [ ] Fetch `/robots.txt`; confirm HTTP 200, plain-text content type and expected directives.
- [ ] Fetch `/sitemap.xml`; confirm HTTP 200, XML content type, valid XML, 24 unique canonical URLs and no auth URLs.
- [ ] Confirm all 22 guide routes resolve and have one canonical URL each.
- [ ] Compare each sitemap `lastmod` and BlogPosting `dateModified` against meaningful content updates.
- [ ] Inspect Page Indexing and URL Inspection in Search Console.
- [ ] Run Lighthouse mobile/desktop and validate structured data.
- [ ] Reassess query/page pairs after more impressions accumulate.

## Scope boundary

This branch documents findings only. No canonical, sitemap, robots, metadata, article copy, or production configuration was changed. Deployment is intentionally not part of this audit-only sprint.
