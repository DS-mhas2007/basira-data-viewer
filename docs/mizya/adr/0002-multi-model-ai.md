# ADR 0002: Multi-Model AI Strategy

- Status: Accepted
- Date: 2026-11-14

## Context
Basira currently uses separate provider paths for chat and structured analytical tasks. MIZYA needs provider flexibility without embedding provider-specific behavior in every feature.

## Decision
Adopt a provider-neutral orchestration layer with multiple model/provider adapters. Route by capability, structured-output reliability, privacy policy, latency, cost and context requirements. A fallback is allowed only if the fallback provider satisfies the same data policy.

## Consequences
- Model selection is explicit policy, not a hard-coded feature detail.
- Every invocation records provider, model, version, task, prompt version, usage, latency and outcome.
- Structured outputs are schema-validated.
- AI explanations remain separate from deterministic analytical evidence.
