# MIZYA — Technical Design

Approved product decisions: all source categories are in architectural scope from day one; workspace contains multiple projects and datasets; balanced analytics/chat/discovery; Freemium plus paid plan. Approved technical direction: hybrid deployment, hybrid execution and multi-model AI.

## Logical architecture

```
Web / PWA
  ├─ Workspace & Project UI
  ├─ Connector UI
  ├─ Local Data Runtime (DuckDB-WASM Worker)
  └─ Local Cache / IndexedDB
          │ authenticated API
          ▼
Application API / Policy Boundary
  ├─ Workspace & Project Service
  ├─ Connector Registry / Credential Broker
  ├─ Conversation & Investigation Service
  ├─ Entitlements / Usage Meter
  └─ AI Orchestrator
       ├─ Model Router
       └─ Provider Adapters
          │
          ├─ Browser/Worker execution
          ├─ Isolated server workers
          └─ Remote connector query pushdown

Postgres: metadata, ownership, conversations, evidence
Object Storage: optional encrypted staged artifacts
Secrets Store: provider and connector credentials
```

## Hybrid deployment
- Client/PWA handles UI, local files and browser analytics.
- Server handles auth, authorization, orchestration, metering, provider calls and secret-bearing operations.
- Isolated workers handle bounded server-side jobs.
- Keep deployment adapters explicit. Lovable-managed hosting is current; do not assume a production move to Cloudflare/Vercel until runtime and secrets are verified.

## Hybrid execution policy
Choose location per operation:
- Browser: local files, sensitive data where feasible, interactive profiling and small/medium DuckDB queries.
- Server worker: large workloads, scheduled tasks, long-running jobs or server-side connectors.
- Remote connector: push down query when supported; retrieve only necessary columns/aggregates.
- Record execution location, data classification, source references, row/byte bounds, timeout and cancellation.

## Project and source model
Suggested tables: workspaces, workspace_members, projects, data_sources, data_assets, source_sync_runs, conversations, messages, investigations, hypotheses, analysis_runs, evidence_nodes, evidence_edges, findings, reports, model_invocations, usage_events and subscriptions.

Use stable UUIDs and versioned schemas. Create a personal workspace for individual users. Every tenant-owned row needs a clear ownership path and RLS. Server-side privileged actions need independent authorization.

DataSource descriptor: id, project_id, connector_type, display_name, non-secret config, credential_ref, capabilities, discovered_assets, schema_version, status, last_sync_at, created_by and timestamps. Never put raw credentials in project JSON or browser storage.

## Connector contract
Each adapter should expose validateConnection, discoverAssets, inspectSchema, executeRead, estimateCost, testCapabilities and close/cancel.

All source categories are in architectural scope, but delivery is staged. Suggested first sequence: CSV/XLSX/JSON/Parquet, Google Sheets/REST, PostgreSQL/MySQL, object storage, then warehouses. This sequence does not narrow the approved architecture.

## Multi-model orchestration
Provider-neutral operations: generateStructured, generateText and streamChat; add embeddings only for an approved use case. Route by task, privacy policy, structured-output reliability, latency, cost and context size. Fallback is allowed only if the provider meets the same data policy. Record provider/model/version, task, prompt version, usage, latency, cost estimate and outcome.

## Investigation and evidence
An investigation contains a question, hypotheses, planned tests, execution records, evidence and conclusion state. Evidence references a reproducible analysis run and includes source/version, method/query, filters/time window, result hash, timestamp, limitations and uncertainty. Keep deterministic results separate from model commentary. Correlation is not causation.

## Security and privacy
Fail closed on auth, quota, policy or ownership failures. Apply RLS to every tenant table. Store credentials in a secrets facility. Minimize provider payloads and expose project-level AI data controls. Bound SQL, rows, bytes, execution time, concurrency and model tokens. Audit connector changes, exports, external actions and permission changes.

## Freemium
Enforce entitlements server-side. Usage records need idempotent action IDs, provider/model cost accounting and abuse controls. Quota tables alone are not a paid subscription system.
