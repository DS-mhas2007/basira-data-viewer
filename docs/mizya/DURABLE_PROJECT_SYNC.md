# MIZYA Durable Project Sync — Sprint 2.2

## Local-first contract

- The browser remains the source of truth for raw files, DuckDB-WASM tables, query results, and analysis state.
- The durable queue stores only validated `ProjectManifest` descriptors: project metadata, source metadata, safe config, file metadata, and asset/schema descriptors.
- Raw file bytes, dataset rows, query results, DuckDB databases, and credentials are not copied into the queue or Supabase.
- Local manifest writes complete before queueing. If queue persistence itself fails, the local save is retained and workspace bootstrap attempts to reconcile it again.

## Queue and retry behavior

- IndexedDB database: `mizya-sync-queue`; object stores: `jobs` and `states`.
- One coalesced queue entry per local project. A newer local manifest replaces an older pending snapshot.
- A manifest fingerprint prevents re-uploading unchanged projects on every workspace mount.
- Retry deadlines and attempt counts survive page reloads.
- Exponential retry starts at 1 second and caps at 5 minutes.
- The worker wakes on app startup, successful authentication, browser online, focus/visibility, and a newly queued manifest.
- The worker runs while the app is open. It is not a background server or a guaranteed service-worker job while the browser is closed.

## Partial failure recovery

- A successful project compare-and-swap followed by a source-stage failure throws `CloudProjectSyncError` with the cloud project ID, workspace ID, and committed project revision.
- The queue persists that revision and retries against it, so a retry can finish source reconciliation without reusing the stale pre-write revision.
- If another device advances the project revision, compare-and-swap fails and the queue is blocked for conflict resolution.
- Source revision conflicts and tombstone resurrection attempts are blocked; the queue never silently rebases or resurrects a deleted source.
- Authentication-required jobs remain blocked until an authenticated session becomes available.

## Current boundaries

- Queue operations are sequential per browser tab; Supabase project/source revision guards remain the cross-device concurrency boundary.
- A lost network acknowledgement after a server commit can still surface as a revision conflict; this is intentionally surfaced rather than guessed away.
- Manual conflict resolution UI, background sync while the browser is closed, and fully atomic server-side project/source synchronization remain future work.
