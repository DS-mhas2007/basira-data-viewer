# MIZYA — Implementation Backlog

Ordered by dependency and risk. Estimates are deferred until Sprint 01 validates repository complexity.

## Phase 0 — Audit and stabilization
- [x] Inspect app, data engine, workspace persistence, AI paths, auth migrations and CI workflows.
- [x] Identify local vs provider-bound data flows.
- [x] Classify keep/refactor/replace/build.
- [ ] Ignore local .env and align environment documentation.
- [ ] Remove quota fail-open behavior after verifying deployed migrations.
- [ ] Add RLS tests for chat thread/message ownership.

## Sprint 01 — Foundations without breaking Basira
- [x] Add versioned Project and DataSource domain types.
- [x] Add ProjectRepository abstraction with an IndexedDB metadata adapter.
- [x] Add a backward-compatible bridge from the existing WorkspaceSession into a project manifest; retain the original Basira session unchanged.
- [x] Add domain and legacy-migration unit tests.
- [ ] Add IndexedDB repository integration tests and multi-source DuckDB restore tests.
- [ ] Add the default personal workspace bootstrap and connect the project repository to the application shell.
- [ ] Keep the current single-file workflow working as the default personal project and verify it in browser smoke tests.

## Sprint 02 — Multi-project workspace
- Create workspace/project metadata schema and RLS.
- Add project create/switch/rename/archive/duplicate/delete.
- Persist source manifests, selected assets, source order and schema metadata.
- Rehydrate DuckDB from stored local sources where supported; otherwise request re-link/re-import. Do not assume browser file handles always persist.
- Add cross-project isolation tests.

## Sprint 03 — Connector framework
- Define connector interface and capability model.
- Implement local CSV, XLSX, JSON and Parquet adapters.
- Add Google Sheets and REST after credential handling is ready.
- Add SQL database adapters and query pushdown.
- Add connector health, schema refresh and sync status.

## Sprint 04 — AI orchestration and privacy
- Add provider-neutral model interface and multi-model router.
- Move Lovable Gateway and OpenRouter behind adapters.
- Add task routing, safe fallbacks, provider allowlists and cost budgets.
- Add per-project AI data policy: local-only, metadata-only, approved aggregates/samples or approved derived results.
- Add redaction, payload minimization and invocation audit trail.
- Make quota fail-closed and add idempotent usage accounting.

## Sprint 05 — Investigation and evidence
- Persist Investigation, Hypothesis and AnalysisRun.
- Build evidence graph with reproducible provenance.
- Implement deterministic discovery candidates and evidence-strength metadata.
- Track counter-evidence and conflicting results.
- Generate reports from validated evidence, not model invention.

## Sprint 06 — Freemium and collaboration
- Define entitlements and server-side limits.
- Integrate billing after plans, cancellation and webhook security are specified.
- Add team roles, sharing and audit log after individual project RLS tests pass.

## Release gates
- No regression in CSV/XLSX Basira flow.
- No cross-user or cross-project access in automated tests.
- Projects restore source descriptors and analysis state or clearly request re-linking.
- Every AI call is policy-checked, metered and auditable.
- Every report claim traces to a source and analysis run.
- Build, typecheck, unit tests and browser smoke tests pass.
