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
- [ ] Add dedicated IndexedDB repository integration tests independent of the browser smoke suite.
- [x] Verify multi-source DuckDB rehydration through a browser E2E scenario.
- [x] Add idempotent personal-workspace bootstrap and starter project creation.
- [x] Add project switcher and project creation controls to the home shell.
- [x] Persist uploaded CSV/XLSX source descriptors against the active project.
- [x] Save local analysis snapshots under project-specific IndexedDB keys.
- [x] Migrate the legacy Basira snapshot into its imported project without deleting the original session.
- [x] Restore a project's saved analysis snapshot when switching to that project.
- [x] Persist each parsed source payload under a project-and-source-scoped IndexedDB key.
- [x] Rehydrate all locally available project sheets into DuckDB on project switch.
- [x] Clear the previous project's in-memory DuckDB registry before loading the next project.
- [x] Detect partial source restoration and warn when one or more local source payloads are missing or unusable.
- [x] Serialize concurrent source-manifest appends and track the active project synchronously during upload.
- [x] Add browser E2E coverage for multi-source restoration, project isolation and cross-source JOIN recovery.
- [x] Verify project switching and source isolation in browser smoke tests.

## Sprint 01.5 — Local source management
- [x] Add a project-scoped source inventory with file size, status, assets and available row counts.
- [x] Activate a saved source sheet in DuckDB without requiring another upload.
- [x] Delete a source descriptor and its local IndexedDB payload together.
- [x] Remove the source's DuckDB aliases and backing tables when deletion succeeds.
- [x] Make source deletion rollback-safe when payload or manifest persistence fails.
- [x] Disable project switching and source mutations while upload/restore operations are active.
- [x] Add browser E2E coverage for source activation, deletion, payload cleanup and project isolation.
- [ ] Detect dependent derived views/joins before source deletion and explain the impact; deletion currently fails safely if DuckDB refuses to drop a referenced table.
## Sprint 02 — Multi-project workspace
- [x] Add the local workspace/project metadata schema and repository.
- [ ] Add server workspace/project metadata and user-scoped RLS after the server project model is defined.
- [x] Add project creation and switching.
- [ ] Add project rename/archive/duplicate/delete lifecycle operations.
- [x] Persist source manifests and source payloads separately in local IndexedDB.
- [x] Rehydrate DuckDB from locally stored project sources; request re-link when payloads are missing.
- [x] Add browser coverage for project isolation and multi-source restore.
- [x] Scope AI chat threads, message loading and chat API requests to the active project.
- [x] Add an explicit flow to assign legacy unscoped chat threads to the active project; they remain isolated until the user chooses to move them.
- [ ] Apply the project-scoped chat migration to the deployed Supabase database.

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
