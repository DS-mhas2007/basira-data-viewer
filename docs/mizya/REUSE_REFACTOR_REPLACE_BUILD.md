# MIZYA — Reuse / Refactor / Replace / Build

## KEEP
- DuckDB-WASM browser Worker and multi-source registration primitives.
- CSV/XLSX parsing and validation.
- SQL validation/tokenization and bounded read-query path.
- Profiling, data quality and cleaning.
- Charts, dashboards and report export.
- Local findings, anomaly signals, playbook and evidence/report primitives.
- Supabase Auth and user-scoped chat persistence.
- Arabic-first RTL components that remain consistent with MIZYA design.

## REFACTOR
- workspace-store: replace the single current session with a versioned workspace/project repository and migration from Basira sessions.
- index route state: extract project state from the single-page route into project-scoped services/stores.
- Data-source lifecycle: persist descriptors and restore/re-authorize sources.
- AI chat: bind conversations to project, sources, analysis runs and evidence.
- AI orchestration: provider-neutral interface with model policy, cost/latency limits and telemetry.
- Quota: fail closed, centralize metering and enforce entitlements server-side.
- Findings/evidence: separate deterministic facts from model interpretations and preserve provenance.

## REPLACE
- Single-session IndexedDB key and single-file export as the primary workspace model; keep a backward-compatible .basira importer.
- Hard-coded single-table context with a project-aware catalog/context builder.
- Provider-specific calls embedded in features with an orchestration boundary.

## BUILD
1. Workspace and Project Management.
2. Universal Connector Framework: manifest, auth, discovery, schema introspection, sync/read modes and health.
3. Hybrid Execution Scheduler.
4. Multi-model Router and provider adapters.
5. Investigation Engine: hypotheses, analytical plans, sequential tests, counter-evidence and conclusions.
6. Evidence Graph with provenance.
7. Discovery Engine: deterministic candidate generation/ranking/validation; LLMs explain and propose, not fabricate evidence.
8. Entitlements and billing.
9. Team collaboration and audit log after individual project security is proven.

## Migration principle
Ship vertical slices. Each slice preserves the Basira workflow while adding one MIZYA capability behind a stable boundary.
