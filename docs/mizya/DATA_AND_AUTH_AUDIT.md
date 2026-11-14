# MIZYA — Data Flow, Privacy and Auth Audit

Scope: source-level review of migrations and relevant client/server paths on main. Not a penetration test or live Supabase audit.

## Data flows observed

| Flow | Processing | Data leaving browser / destination |
|---|---|---|
| File import and local analysis | CSV/XLSX parsing, DuckDB, profiling, cleaning, charts | Original file is not uploaded by the inspected local analysis path |
| Conversational SQL agent | Browser tools execute SQL; server streams model interaction | Conversation, dataset metadata and SQL tool results reach Lovable AI Gateway |
| AI query planner | Server sends question, table, schema and up to 10 sample rows | OpenRouter |
| Executive brief | Server sends analysis-derived JSON: file metadata, quality, KPIs, signals, insights and columns | OpenRouter |
| Session persistence | One session stored in IndexedDB | Local browser |
| Chat persistence | User/assistant message parts inserted into Supabase | Supabase Postgres unless persistence is disabled |

Do not describe AI as “no data leaves the device”. Accurate wording: the original file is processed locally in the inspected workflow, while selected metadata, samples, conversation content and derived results may be sent to configured AI providers.

## Migrations found
Four migrations exist:
1. chat_threads and chat_messages with per-user RLS.
2. Stronger chat_messages write policy requiring the parent thread to belong to auth.uid(); title/parts size constraints.
3. plan_limits, user_plans, ai_usage, atomic consume_ai_quota(), and RLS read policies.
4. Read-only get_ai_quota() RPC.

No persistent workspace, project, dataset, external connection, investigation, evidence graph, team or billing tables were found in these migrations. plan_limits is intentionally readable to authenticated users; user plans and usage are user-scoped. Chat messages are user-scoped and parent-thread ownership is checked on writes.

## Auth observations
- Server functions require a Bearer token and validate claims before exposing a user-scoped Supabase client.
- Chat route independently calls auth.getUser(token), then checks thread access before processing.
- The strengthened message policy checks both message ownership and parent-thread ownership on writes.
- Avoid service-role access in user-facing data paths unless the server independently enforces tenant/resource ownership.

## Findings
### High
- quota.server currently allows a request when consume_ai_quota RPC is missing. This transitional fail-open behavior must be removed before production paid plans.
- Define explicit AI disclosure and project-level controls: provider, purpose, fields sent, retention assumptions, consent and minimization.
- Scope conversations and AI requests to project membership before multi-project rollout.

### Medium
- .env is tracked. The inspected file contains Supabase project/public publishable configuration, not a variable named like a private secret; nevertheless, ignore .env and commit placeholders only. Never commit service-role or provider API keys.
- .env.example is inconsistent: it documents VITE_SUPABASE_ANON_KEY while code reads VITE_SUPABASE_PUBLISHABLE_KEY; it omits server-side SUPABASE_PUBLISHABLE_KEY and LOVABLE_API_KEY.
- Add RLS integration tests for chat ownership and future project/source/investigation tables. Current PGlite test focuses on quota.
- Define deletion/export across IndexedDB, Supabase, object storage and project artifacts.

## Not verified
Live RLS state, production secrets, provider retention settings, backups, runtime telemetry and deployed environment variables were not accessible.
