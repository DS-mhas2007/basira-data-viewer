# SEO improvements
## Supported AI sign-in
- [x] Replace implicit guest registration across shared AI callers and document account-based access.
- [ ] Verify signed-out local analysis, sign-in prompts, and a real signed-in AI request; run affected tests.

- [x] Update homepage search metadata and canonical URL.
- [x] Add guide breadcrumbs and structured guide-directory links.
- [x] Complete sign-in page canonical metadata.
- [x] Verify rendered metadata, navigation, and mobile layout.

## Additional search improvements
- [x] Enrich guide and site structured data with consistent identities.
- [x] Improve the main guide's links to related articles.
- [x] Verify server-rendered metadata and guide navigation on mobile.

## Glass integration
- [x] Restore the typed icon library and connect existing navigation with fallback icons.
- [x] Add scoped glass surfaces to dashboard and metric cards without changing analysis or charts.
- [x] Run available tests and lint; inspect automated build and desktop/mobile rendering without publishing. Full lint reports pre-existing violations; changed files pass.

## Chat experience
- [x] Simplify the conversation layout and unify the composer with accessible send/stop controls.
- [x] Improve answer readability, copying, and scrolling without interrupting reading.
- [x] Verify interactions and mobile/desktop display without publishing. All 19 targeted tests pass; the live Arabic question remained pending after 22 seconds, so final AI output was not verified.