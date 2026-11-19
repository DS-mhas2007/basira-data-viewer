# MIZYAi — SEO Sprint 01.1: source validation and blockers

Audit date: 2026-11-19
Related PR: #37
Branch: `chore/seo-sprint-01-audit`
Scope: read-only source validation and CI diagnosis. No application code or production configuration changed.

## Confirmed implementation details

- `src/routes/sitemap[.]xml.ts` generates the sitemap from the shared `GUIDES` registry.
- The sitemap includes the homepage, guide index, and each guide route. The current registry contains 22 guides, so the expected source count is 24 URLs.
- Sitemap response code sets `Content-Type: application/xml; charset=utf-8` and a one-hour public cache policy.
- `public/robots.txt` permits public crawling, disallows `/auth`, and references the current Lovable sitemap URL.
- `src/lib/seo.ts` uses the shared `guideDates` helper for BlogPosting `datePublished` and `dateModified`.
- Existing `src/lib/guide-dates.test.ts` checks ISO date shape, ordering, and structured-data field presence. It does not verify that dates correspond to substantive article edits.

## Date metadata risk — still requires content-history verification

`src/lib/guide-dates.ts` currently defaults:
- `published`: `2026-09-03`
- `updated`: `2026-11-17`

Two guide paths have explicit publication and update dates of `2026-11-18`. All other guide paths inherit the shared update date unless overridden.

This is a confirmed implementation fact, not proof that the dates are false. Before changing them, compare each guide's content history and identify meaningful editorial updates. Do not replace dates with the current build or deployment date. Add tests that assert the chosen per-guide date policy after the history review.

## CI blocker found on PR #37

GitHub Actions run `44473640463` failed in the `Typecheck and Vitest` job at `bun install --frozen-lockfile`.

The log reports that `@phosphor-icons/react` exists in `package.json` but is absent from `bun.lock`. Typecheck, Vitest, the isolated PGlite runner, and Build Check did not run.

The same dependency mismatch is visible on the PR base branch (`main`): its `package.json` declares `@phosphor-icons/react`, while the root workspace dependency list in `bun.lock` does not. This is a repository dependency-lock consistency issue, not an SEO code regression. Track and repair it separately so the SEO audit remains scoped.

The base commit also reports a failed Vercel status check. The available status response does not expose the deployment failure reason; it must be diagnosed from the Vercel deployment log. Do not attribute it to PR #37.

## Live verification status

Attempts to retrieve the deployed homepage, representative guide, `/robots.txt`, and `/sitemap.xml` from the current execution environment returned inaccessible/internal errors. This does not establish that the production site is down.

Still unverified:
- deployed HTTP status and redirect behavior;
- server-rendered metadata and canonical tags;
- deployed sitemap XML validity, unique URL count, and content;
- actual guide route responses and internal-link integrity;
- Google URL Inspection and indexed canonical selection;
- Lighthouse, CrUX, and Core Web Vitals.

Search Console's 24 submitted sitemap URLs and zero reported sitemap errors/warnings remain useful processing evidence, but are not a live HTTP validation or an indexed-page count.

## Next actions

1. Resolve the dependency lock mismatch in a separate maintenance change, then rerun CI.
2. Diagnose the Vercel failure on the base deployment before treating deployment as a PR regression.
3. Run deployed route, robots, sitemap, canonical, and rendered-metadata checks from a network environment that can access the production host.
4. Compare guide content history with `guideDates`; only then decide whether per-guide `lastmod` and `dateModified` values need correction.
5. Add automated tests for sitemap URL uniqueness, expected guide coverage, XML escaping, and the date policy.

## Scope boundary

This follow-up is documentation and source inspection only. No SEO metadata, sitemap implementation, robots directives, guide content, dependency files, or deployment settings were modified.
