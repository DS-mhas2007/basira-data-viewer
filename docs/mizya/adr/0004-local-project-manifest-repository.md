# ADR 0004: Local Project Manifest Repository as the First Adapter

- Status: Accepted for Sprint 01
- Date: 2026-11-14

## Context

Basira already persists its active parsed-file session in browser IndexedDB. MIZYA needs a multi-project manifest, but moving user files to a remote database or changing the current workflow in the first sprint would increase migration and privacy risk.

## Decision

Introduce a repository interface for project manifests and ship an IndexedDB adapter first. The manifest stores project/source metadata and asset descriptors only; it does not store raw file bytes, credentials or parsed row payloads. Keep the legacy Basira session store intact and provide a one-way, idempotent migration bridge that records the legacy session key.

Parsed source payloads are stored separately in the existing browser IndexedDB session store, keyed by both project ID and source ID. These payloads are the locally parsed `ParsedFile` representation (including rows and sheets), not original file bytes. On project activation, the app clears the in-memory DuckDB source registry and rehydrates every available local source sheet under a project/source-scoped alias. Missing payloads are treated as requiring re-link/re-import; no payload is uploaded to a server by this flow.

The repository interface is intentionally storage-agnostic. A later authenticated server adapter can persist workspace/project metadata in Supabase, while browser-local file payloads remain local unless the user explicitly chooses an approved sync flow.

## Consequences

- The application can adopt a project domain model without breaking the current single-file workflow.
- Legacy data remains available in the old store during migration.
- Project manifests remain metadata-only; parsed source payloads are stored separately under project/source-scoped IndexedDB keys.
- Browser storage quotas may prevent some parsed payloads from being saved; those sources remain marked as requiring re-link/re-import.
- Project activation clears the prior in-memory DuckDB source registry before restoring the selected project's locally available sheets.
- Local-file projects may require re-linking if browser storage is unavailable or cleared.
- IndexedDB repository integration and cross-project isolation still require dedicated tests.
- This is a first adapter, not the final SaaS persistence architecture.
