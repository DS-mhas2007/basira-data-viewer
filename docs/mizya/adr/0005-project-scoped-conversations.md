# ADR 0005: Project-scoped AI conversations

## Status
Accepted

## Context

MIZYA projects are currently created and persisted in the browser-local project repository. Their identifiers are client-generated strings; there is not yet a server-side workspace/project table that can serve as a foreign-key target. Chat threads, however, are stored in Supabase and were previously listed as one user-wide collection. That allowed a thread from one local project to be selected while another project was active.

## Decision

- Add a nullable `project_id TEXT` column to `public.chat_threads` and index `(user_id, project_id, updated_at DESC)`.
- Treat `NULL` as the legacy unscoped conversation bucket. Project-scoped queries must never include those rows implicitly.
- Filter thread listing, creation, message loading, rename and delete operations by the active project identifier.
- Include `projectId` in chat API requests and verify it matches the stored thread scope before processing a turn. A mismatch is reported as not found.
- Continue relying on the existing user-scoped Supabase RLS policies; `project_id` is an additional isolation boundary inside one user's data, not a replacement for user ownership.

## Consequences

- Conversations are isolated between local MIZYA projects without prematurely introducing a server project model.
- Existing unscoped threads remain stored and are not silently assigned to an arbitrary project. The chat drawer lists them separately and lets the user explicitly assign one to the active project.
- The migration must be applied to the deployed Supabase database before project-scoped chat is available there.
- When a server-side project/workspace model is introduced, `project_id` can be migrated to a foreign key and reconciled with server-owned project identifiers.

## Alternatives considered

- Keep one user-wide chat list: rejected because it permits accidental cross-project context reuse.
- Automatically assign all legacy threads to the first project opened: rejected because that would make an arbitrary data-ownership decision.
- Add a full server-side project table now: deferred; the current project architecture is intentionally local-first and has not yet established server project lifecycle semantics.