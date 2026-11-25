# Audit seal provenance model

The local audit seal is a consistency record, not a digital signature, proof of
authenticity, or evidence that execution occurred in a trusted environment.
It is calculated in the user's browser and must be treated as client-generated
evidence.

The record separates four identities:

1. **Source identity** is the versioned SHA-256 fingerprint of the normalized
   imported sheet. It remains unchanged by downstream transformations. It does
   not identify the original file bytes.
2. **Transformation identity** fingerprints the ordered cleaning operations and
   their parameters together with the source fingerprint. Operation labels and
   affected-row counts are retained as history but are not recipe inputs.
3. **Execution identity** binds the source alias and revisions, transformation
   fingerprint, output fingerprint, row count, ordered schema, and DuckDB-WASM
   engine version. It is an unsigned local record, not trusted remote
   attestation.
4. **Output identity** is computed from the active DuckDB relation, not copied
   from the imported source.

Output fingerprint canonicalization is versioned as `dataset-output-v1`:

- Column order, names, and normalized DuckDB SQL types are significant.
- Rows are serialized by DuckDB's type-aware JSON conversion. SQL `NULL` is
  represented as JSON `null`; finite numeric, date, and timestamp values use
  DuckDB's JSON representation under the recorded engine version.
- Floating-point NaN and infinity are rejected rather than silently normalized.
- Row order is not semantically significant. Canonical row JSON is sorted
  before hashing.
- Duplicate rows are significant and their exact multiplicity is retained.
- The exact row count and ordered schema are included in the output fingerprint.

The application invalidates the displayed record as soon as the active
relation revision changes, then checks source/relation revisions and the
transformation recipe again before publishing an asynchronous result. If the
source, transformation recipe, output snapshot, schema, or engine metadata
cannot be established, the UI and exported report show an incomplete state and
do not describe the source fingerprint as the output fingerprint.
