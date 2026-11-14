# MIZYA — Current Architecture Baseline

Audit baseline: main, commit e63f6680410a306e599f56d10db9fa5b67065aae as observed on 2026-11-14. Re-check branch head before implementation. This is source inspection, not runtime certification.

## Runtime
- Frontend: React 19, TanStack Start/Router, Vite 8, Tailwind 4.
- Server: TanStack Start handlers/server functions and Nitro through the Lovable Vite preset. Config comments identify Cloudflare as the preset default build target. The app is currently associated with Lovable hosting; no root wrangler.toml was found.
- Identity and persistence: Supabase Auth + Postgres. Chat threads/messages and AI plan/usage tables are persisted.
- Local analytics: DuckDB-WASM in a browser Worker. Parsing, profiling, quality checks, cleaning, SQL execution, charts and local findings run primarily in-browser.
- AI: Lovable AI Gateway for chat; OpenRouter for SQL planning and executive brief generation. No shared provider-neutral orchestrator yet.
- Offline: PWA caches app/runtime assets. User data is persisted separately in browser IndexedDB.

## Data and workspace lifecycle
- Inspected ingestion flow supports CSV and XLSX.
- workspace-store persists one session under IndexedDB key current: one parsed file, selected sheet, cleaning steps and pinned insights.
- .basira export/import serializes that same single-file session.
- duckdb-service supports multiple in-memory sources by alias and relation/view creation. Preserve this capability.
- Runtime DuckDB registrations are not represented by a durable multi-source project manifest, so reload cannot reconstruct a multi-source project from the current persistence model.

## Reusable capabilities
DuckDB-WASM, SQL validation, CSV/XLSX parsing, profiling, data quality, cleaning, anomaly signals, local findings, evidence/report primitives, charts/export, chat UI, Supabase Auth and quota migrations.

## Boundaries
- Local SQL execution does not mean AI interactions remain local. Chat context and SQL tool results are sent to the configured model gateway; other AI paths send samples or derived analysis.
- Quota tables do not constitute complete billing or subscriptions.
- This audit did not run the app/tests, inspect live Supabase policies, or verify production secrets/deployment state.
