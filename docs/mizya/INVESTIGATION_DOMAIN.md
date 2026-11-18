# MIZYA Investigation Domain — Foundation

## Product standard

MIZYA should behave like an analytical evidence workspace, not merely a conversational dashboard. A user-facing claim should be traceable to the source snapshot, method, query or model evaluation, result, assumptions and limitations that produced it.

## Domain separation

| Concept | Meaning |
|---|---|
| Investigation | A persistent question-led unit of analytical work |
| Hypothesis | A testable claim with an explicit claim type |
| AnalysisRun | One bounded execution using a declared method and source snapshot |
| Evidence | A result with provenance, polarity and limitations |
| EvidenceEdge | A relationship between evidence records |
| Conclusion | A reviewed interpretation that references evidence |
| Report | A presentation of validated evidence and approved conclusions |

## Evidence contract

Analysis-derived evidence must:

1. Refer to a successful AnalysisRun in the same investigation.
2. Carry the exact source snapshot used by that run.
3. Match the run's result hash.
4. Preserve a schema fingerprint and computation timestamp.
5. State its method and known limitations.
6. Record polarity relative to the hypothesis.
7. Carry an explicit assessment state and rationale.

An AI explanation may summarize evidence, but it must never create or alter the underlying measured value.

## Claim taxonomy

- **Descriptive:** what is observed in the dataset.
- **Associational:** what variables or groups move together.
- **Predictive:** how well a model predicts a defined outcome under an evaluation design.
- **Causal:** what would change under an intervention, conditional on a defensible identification strategy and assumptions.
- **Prescriptive:** what action is recommended, with the objective and constraints made explicit.

A correlation cannot be promoted to a causal effect by wording alone.

## Initial implementation boundary

This foundation contains TypeScript domain contracts and pure rules only. It does not yet persist investigations, run SQL, synchronize data, or render a new UI. Those concerns will be layered on after the contracts are reviewed and tested.

## Verification

Run the targeted domain suite:

    bunx vitest run src/domains/investigations/domain/rules.test.ts

Then run repository typecheck, full unit tests, build and browser smoke checks through the existing CI workflows.
