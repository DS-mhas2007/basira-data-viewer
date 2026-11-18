# ADR 0006: Evidence-first investigation domain

## Status

Accepted for the Investigation Domain foundation.

## Context

MIZYA's product goal is to become a reliable analytical reference: users must be able to inspect how a finding was produced, reproduce its calculation, challenge it with counter-evidence, understand its limitations, and distinguish measured results from generated interpretation.

A conventional chat history or a dashboard screenshot is not an adequate evidence record. Evidence must be connected to a defined source snapshot and a reproducible analysis run, while conclusions remain an explicitly reviewed interpretation.

## Decisions

### 1. Separate claims, computations, evidence and interpretation

- A hypothesis is a testable claim with an explicit claim kind.
- An analysis run records the method, execution location, engine, source snapshot, query/parameters, status and result hash.
- Evidence records a result and its provenance, polarity, limitations and assessment.
- Conclusions reference evidence IDs; they do not replace or mutate the underlying evidence.
- AI-generated narrative is not itself computational evidence.

### 2. Classify claim strength by what is being asserted

The domain distinguishes descriptive, associational, predictive, causal and prescriptive claims.

- Associational results must not be represented as causal effects.
- Causal claims require a stated exposure, outcome, identification strategy and assumptions. Observational causal claims must also describe the confounder strategy.
- Predictive claims require an evaluation design and a defined outcome.
- The domain does not assign a universal numeric confidence score. Evidence assessment is explicit, rationale-bearing and attributable.

### 3. Preserve provenance and reproducibility

Analysis-derived evidence must be linked to a successful analysis run. Its source references must match the run's source snapshot, and its result hash must match the run's result hash. The schema fingerprint and computation timestamp are retained.

Evidence is treated as an auditable record. Corrections should produce a superseding record or an explicit relation, rather than silently rewriting what was previously observed.

### 4. Require human review for approved conclusions

An assistant may draft a conclusion, but approval requires an identified reviewer, references to evidence from the same investigation, assessed evidence, and polarity consistent with the stated outcome.

An investigation cannot be completed while analysis runs are queued/running or before it has an approved conclusion.

### 5. Keep source data local by default

The hybrid architecture synchronizes project and investigation metadata, provenance and compact evidence records. Raw user files and full local database contents remain local by default. Any future upload or remote execution requires a separately defined data policy and explicit user controls.

## Consequences

- The first implementation phase establishes domain contracts and pure validation rules before database migrations or UI integration.
- Confidence is not represented as a free-floating percentage. Assessment criteria can be expanded with discipline-specific rubrics and reviewer guidance.
- Cloud persistence must preserve the same ownership path and integrity rules enforced by the domain layer.
- Reporting will consume approved conclusions and linked evidence, not unverified model-generated prose.

## Deferred

- Statistical evidence-strength rubrics for descriptive, associational and causal designs.
- Evidence citations to external literature and reference-resolution workflows.
- Server-side workspace/project identity migration and row-level security.
- Offline synchronization, conflict resolution and deletion/retention policy.
