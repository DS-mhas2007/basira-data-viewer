# ADR 0004: Local Project Manifest Repository as the First Adapter

- Status: Accepted for Sprint 01
- Date: 2026-11-14

## Context

Basira already persists its active parsed-file session in browser IndexedDB. MIZYA needs a multi-project manifest, but moving user files to a remote database or changing the current workflow in the first sprint would increase migration and privacy risk.

## Decision

Introduce a repository interface for project manifests and ship an IndexedDB adapter first. The manifest stores project/source metadata and asset descriptors only; it does not store raw file bytes, credentials or parsed row payloads. Keep the legacy Basira session store intact and provide a one-way, idempotent migration bridge that records the legacy session key.

The repository interface is intentionally storage-agnostic. A later authenticated server adapter can persist workspace/project metadata in Supabase, while browser-local file payloads remain local unless the user explicitly chooses an approved sync flow.

## Consequences

- The application can adopt a project domain model without breaking the current single-file workflow.
- Legacy data remains available in the old store during migration.
- Local-file projects may require re-linking if browser storage is unavailable or cleared.
- IndexedDB repository integration and cross-project isolation still require dedicated tests.
- This is a first adapter, not the final SaaS persistence architecture.
