import { describe, expect, it } from "vitest";
import {
  canTransitionAnalysisRun,
  canTransitionHypothesis,
  canTransitionInvestigation,
  getClaimMethodologyIssues,
  validateConclusionForApproval,
  validateEvidenceAttachment,
  validateInvestigationCompletion,
} from "./rules";
import type { AnalysisRun, Conclusion, Evidence } from "./types";

const sourceRef = {
  projectId: "project_1",
  sourceId: "source_1",
  sourceVersion: "v1",
  schemaFingerprint: "schema_hash_1",
};

function makeRun(overrides: Partial<AnalysisRun> = {}): AnalysisRun {
  return {
    id: "run_1",
    investigationId: "investigation_1",
    hypothesisId: "hypothesis_1",
    status: "succeeded",
    method: "sql",
    execution: "browser",
    engine: { name: "DuckDB-WASM", version: "1.0.0" },
    sourceRefs: [sourceRef],
    query: { language: "sql", text: "SELECT COUNT(*) FROM dataset", hash: "query_hash_1" },
    parameters: {},
    resultHash: "result_hash_1",
    startedAt: "2026-01-01T10:00:00.000Z",
    completedAt: "2026-01-01T10:00:01.000Z",
    version: 1,
    createdAt: "2026-01-01T10:00:00.000Z",
    ...overrides,
  };
}

function makeEvidence(overrides: Partial<Evidence> = {}): Evidence {
  return {
    id: "evidence_1",
    investigationId: "investigation_1",
    hypothesisId: "hypothesis_1",
    title: "Observed result",
    summary: "A reproducible query result.",
    kind: "query-result",
    polarity: "supports",
    origin: { kind: "analysis-run", analysisRunId: "run_1" },
    sourceRefs: [sourceRef],
    result: { format: "scalar", value: 42 },
    provenance: {
      method: "SQL aggregation",
      computedAt: "2026-01-01T10:00:01.000Z",
      schemaFingerprints: ["schema_hash_1"],
      resultHash: "result_hash_1",
      queryHash: "query_hash_1",
      rowCount: 2161,
      limitations: [],
    },
    assessment: {
      level: "moderate",
      rationale: "The calculation is reproducible but descriptive.",
      assessedBy: "reviewer_1",
      assessedAt: "2026-01-01T10:05:00.000Z",
    },
    createdAt: "2026-01-01T10:00:02.000Z",
    version: 1,
    ...overrides,
  };
}

function makeConclusion(overrides: Partial<Conclusion> = {}): Conclusion {
  return {
    id: "conclusion_1",
    investigationId: "investigation_1",
    hypothesisId: "hypothesis_1",
    statement: "The evidence supports the stated hypothesis.",
    rationale: "The referenced analysis is consistent with the hypothesis.",
    outcome: "supported",
    status: "in-review",
    evidenceIds: ["evidence_1"],
    limitations: ["Only the available dataset was assessed."],
    createdBy: "assistant",
    createdAt: "2026-01-01T10:10:00.000Z",
    updatedAt: "2026-01-01T10:10:00.000Z",
    ...overrides,
  };
}

describe("investigation lifecycle rules", () => {
  it("allows only explicit investigation state transitions", () => {
    expect(canTransitionInvestigation("draft", "planning")).toBe(true);
    expect(canTransitionInvestigation("review", "completed")).toBe(true);
    expect(canTransitionInvestigation("completed", "active")).toBe(false);
    expect(canTransitionInvestigation("archived", "draft")).toBe(false);
  });

  it("requires a hypothesis to enter testing before receiving an outcome", () => {
    expect(canTransitionHypothesis("proposed", "testing")).toBe(true);
    expect(canTransitionHypothesis("proposed", "supported")).toBe(false);
    expect(canTransitionHypothesis("supported", "testing")).toBe(true);
  });

  it("prevents a completed analysis run from being silently restarted", () => {
    expect(canTransitionAnalysisRun("queued", "running")).toBe(true);
    expect(canTransitionAnalysisRun("running", "cancelled")).toBe(true);
    expect(canTransitionAnalysisRun("succeeded", "running")).toBe(false);
    expect(canTransitionAnalysisRun("failed", "succeeded")).toBe(false);
  });
});

describe("scientific claim guardrails", () => {
  it("requires an identification strategy and assumptions for causal claims", () => {
    const issues = getClaimMethodologyIssues("causal", {
      design: "observational",
      exposure: "Treatment",
      outcome: "Recovery",
      assumptions: [],
    });

    expect(issues).toContain("causal-identification-strategy-required");
    expect(issues).toContain("causal-assumptions-required");
    expect(issues).toContain("causal-confounder-strategy-required");
  });

  it("accepts a causal claim only when its design requirements are described", () => {
    const issues = getClaimMethodologyIssues("causal", {
      design: "observational",
      exposure: "Treatment",
      outcome: "Recovery",
      confounderStrategy: "Adjustment using pre-specified baseline covariates",
      identificationStrategy: "Target-trial emulation",
      assumptions: ["No unmeasured confounding", "Consistency", "Positivity"],
    });

    expect(issues).toEqual([]);
  });

  it("requires an evaluation design for predictive claims", () => {
    expect(
      getClaimMethodologyIssues("predictive", {
        design: "descriptive",
        outcome: "",
        assumptions: [],
      }),
    ).toEqual([
      "predictive-evaluation-design-required",
      "predictive-outcome-required",
    ]);
  });
});

describe("evidence provenance integrity", () => {
  it("accepts evidence from its successful and matching analysis run", () => {
    expect(validateEvidenceAttachment(makeEvidence(), makeRun())).toEqual([]);
  });

  it("rejects evidence from a running analysis", () => {
    expect(
      validateEvidenceAttachment(makeEvidence(), makeRun({ status: "running" })),
    ).toContain("analysis-run-not-succeeded");
  });

  it("rejects evidence whose source snapshot or result hash differs", () => {
    const evidence = makeEvidence({
      sourceRefs: [{ ...sourceRef, sourceVersion: "v2" }],
      provenance: {
        ...makeEvidence().provenance,
        resultHash: "different_hash",
      },
    });

    const issues = validateEvidenceAttachment(evidence, makeRun());
    expect(issues).toContain("evidence-source-snapshot-not-in-analysis-run");
    expect(issues).toContain("evidence-result-hash-mismatch");
  });

  it("rejects evidence when the source query hash does not match", () => {
    const evidence = makeEvidence({
      provenance: { ...makeEvidence().provenance, queryHash: "different_query_hash" },
    });
    expect(validateEvidenceAttachment(evidence, makeRun())).toContain(
      "evidence-query-hash-mismatch",
    );
  });
});

describe("conclusion review rules", () => {
  it("requires a human reviewer for an assistant-authored draft", () => {
    const issues = validateConclusionForApproval(
      makeConclusion(),
      [makeEvidence()],
      "",
    );
    expect(issues).toContain("conclusion-reviewer-required");
  });

  it("rejects conclusions that claim support without supporting evidence", () => {
    const evidence = makeEvidence({ polarity: "contradicts" });
    expect(
      validateConclusionForApproval(makeConclusion(), [evidence], "reviewer_1"),
    ).toContain("conclusion-supporting-evidence-required");
  });

  it("does not approve conclusions that cite unassessed evidence", () => {
    const evidence = makeEvidence({
      assessment: { level: "unassessed", rationale: "Not reviewed yet." },
    });
    expect(
      validateConclusionForApproval(makeConclusion(), [evidence], "reviewer_1"),
    ).toContain("conclusion-contains-unassessed-evidence");
  });

  it("allows an evidence-backed inconclusive conclusion without forcing polarity", () => {
    const evidence = makeEvidence({ polarity: "neutral" });
    expect(
      validateConclusionForApproval(
        makeConclusion({ outcome: "inconclusive" }),
        [evidence],
        "reviewer_1",
      ),
    ).toEqual([]);
  });

  it("requires an approved conclusion for the investigation being completed", () => {
    const draft = makeConclusion();
    const issues = validateInvestigationCompletion({
      investigationId: "investigation_1",
      runs: [makeRun()],
      conclusions: [draft],
    });
    expect(issues).toContain("investigation-approved-conclusion-required");

    expect(
      validateInvestigationCompletion({
        investigationId: "investigation_1",
        runs: [makeRun()],
        conclusions: [
          makeConclusion({
            status: "approved",
            approvedBy: "reviewer_1",
            approvedAt: "2026-01-01T10:15:00.000Z",
          }),
        ],
      }),
    ).toEqual([]);
  });

  it("blocks completion while an analysis run is still active", () => {
    expect(
      validateInvestigationCompletion({
        investigationId: "investigation_1",
        runs: [makeRun({ status: "running" })],
        conclusions: [
          makeConclusion({
            status: "approved",
            approvedBy: "reviewer_1",
            approvedAt: "2026-01-01T10:15:00.000Z",
          }),
        ],
      }),
    ).toContain("investigation-has-active-analysis-runs");
  });
});
