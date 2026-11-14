# ADR 0001: Hybrid Deployment and Hybrid Execution

- Status: Accepted
- Date: 2026-11-14

## Context
MIZYA must support local files and browser analytics alongside authenticated multi-project persistence, external connectors, long-running jobs, AI provider calls and usage enforcement. No single execution location fits all workloads.

## Decision
Adopt hybrid deployment and hybrid execution. Keep interactive local-file analysis in the browser where practical. Use authenticated server APIs for policy enforcement, model routing, metering and secret-bearing operations. Use isolated workers for bounded server-only workloads. Use connector-side query pushdown where supported. Select execution location per operation based on data classification, workload and connector capability.

## Consequences
- Every operation declares an execution policy and provenance.
- Provider payloads are minimized and governed by project policy.
- Browser state is reconstructed from a durable project manifest.
- Deployment adapters must be validated before changing hosting providers.
