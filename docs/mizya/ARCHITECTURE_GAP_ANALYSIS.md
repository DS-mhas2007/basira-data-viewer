# MIZYA — Architecture Gap Analysis

## Conclusion
Evolve Basira incrementally. The browser analytics engine is a useful execution substrate; the largest gap is the missing durable project and intelligence layer around it. The inspected code does not justify a rewrite or replacing DuckDB.

| Domain | Basira baseline | MIZYA target | Gap |
|---|---|---|---|
| Workspace | One local session | Multiple durable workspaces | Critical |
| Projects | Single file/session export | Multiple projects and lifecycle | Critical |
| Data sources | CSV/XLSX; DuckDB supports multiple in-memory sources | Unified connector registry and multi-source projects | High |
| Persistence | IndexedDB single key; chat in Supabase | Durable project/source state and recovery | Critical |
| Analytics | Local SQL, profiling, quality, cleaning, charts | Reusable services across sources | Medium |
| Conversational analytics | Chat and SQL planner use separate provider paths | Project-aware conversation context | High |
| Discovery | Local findings and anomaly signals | Evidence-backed discovery engine | High |
| Investigations | No complete persisted lifecycle observed | Hypotheses, tests, evidence, counter-evidence and conclusions | Critical |
| Evidence | Initial evidence/report structures | Typed, traceable evidence graph | High |
| AI orchestration | Lovable Gateway + OpenRouter paths | Provider-neutral multi-model router | High |
| Execution | Browser DuckDB + server AI | Policy-driven hybrid scheduler | High |
| Security | Auth/RLS for chat and quotas | Tenant isolation across project resources | High |
| Monetization | Quota tables; no completed billing | Freemium entitlements and billing | High |
| Collaboration | No durable team model observed | Shared workspaces, roles and audit history | Later |

## Central mismatch
DuckDB can register multiple sources, but the persisted WorkspaceSession stores one file and one sheet under a single IndexedDB key named current. Reopening the app restores one file/sheet, not a project graph of source connections and analysis state. This is the main migration seam.

## Target domain model
Organization (optional), Workspace, Project, DataSource, DataAsset, Conversation, Investigation, Hypothesis, AnalysisRun, Evidence, Finding/Discovery, Report, ModelInvocation/UsageEvent and ConnectorCredential (secret reference only).

All tenant-owned records must have an ownership path and enforce it with RLS or an explicit server authorization boundary.

## Non-goals for first migration
- Do not replace DuckDB-WASM.
- Do not rewrite visualizations.
- Do not promise every external connector is implemented in MVP. Build the connector contract first and deliver adapters in ranked batches.
- Do not move all user data to the server by default.
