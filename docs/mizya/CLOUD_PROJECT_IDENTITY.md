# MIZYA Cloud Project Identity — Sprint 2

## Decision
The first cloud release has one personal workspace per authenticated user (owner_id). The schema retains a workspace boundary for future membership and team collaboration, but no membership table or shared access is implemented now.

## Identity mapping
- Local workspace ID remains ws_personal_local_v1.
- Local project IDs such as prj_... remain unchanged.
- workspaces.id and projects.id are cloud UUIDs.
- projects.local_project_id maps a local project to its cloud identity.
- chat_threads.project_id remains the legacy TEXT local identifier.
- chat_threads.cloud_project_id is the new authoritative UUID foreign key.
- Legacy and unscoped chat threads remain valid when cloud_project_id IS NULL.

## Data boundary
IndexedDB/browser: original files and bytes, DuckDB-WASM tables and execution, full result sets and temporary analysis state.
Supabase: workspace/project identity, project metadata, source descriptors, and chat-to-cloud-project association.
Never sync raw files, dataset rows, credentials, full query results or local DuckDB databases through this repository.

## Security invariants
1. Every workspace row is owned by auth.uid().
2. Project access is authorized through its workspace owner.
3. Source descriptor access is authorized through project → workspace ownership.
4. A chat thread may reference a cloud project only when the same authenticated user owns it.
5. Legacy project_id remains untouched.
6. The client uses the authenticated Supabase session; no service-role key is used.
7. Source config is checked by local manifest validation and a database constraint.

## Sync behavior and deferred work
Project/source upserts are idempotent using the local identity keys. This initial sync does not delete remote source descriptors when a local source is removed; tombstones/deletion policy and offline conflict resolution are deferred. Old chat rows are not migrated automatically; linking occurs only when a trusted cloud project identity is available.

## Verification
Unit tests cover the sync boundary. Before applying this migration, run database-level RLS tests with two authenticated users: owner access succeeds; cross-owner reads/inserts/updates fail; cross-owner chat attachment fails; NULL cloud_project_id legacy threads remain usable. This PR does not apply migrations to a live Supabase project.
