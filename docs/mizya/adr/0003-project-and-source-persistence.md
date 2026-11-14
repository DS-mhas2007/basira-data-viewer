# ADR 0003: Durable Projects and Data Source Manifests

- Status: Accepted
- Date: 2026-11-14

## Context
Basira can register multiple sources in DuckDB at runtime, but its persisted workspace session is one file/sheet under one IndexedDB key. Runtime registration is not durable project management.

## Decision
Introduce a versioned Project model and durable DataSource manifest. Persist source descriptors, selected assets, schema/version metadata and project state independently of transient DuckDB objects. Rebuild DuckDB from authorized local sources on restore.

For browser-local files, support re-link/re-import when the browser cannot guarantee continued access. Do not upload local files merely to make restoration appear seamless. Keep a backward-compatible importer for existing .basira exports.

## Consequences
- Multi-source restore and project isolation are explicit test requirements.
- DuckDB remains the initial local analytics engine.
- Connector credentials are secret references, never values in project manifests.
