import type {
  AnalysisRun,
  AnalysisRunStatus,
  ClaimKind,
  ClaimMethodology,
  Conclusion,
  Evidence,
  HypothesisStatus,
  InvestigationStatus,
} from "./types";

const INVESTIGATION_TRANSITIONS: Record<InvestigationStatus, readonly InvestigationStatus[]> = {
  draft: ["planning", "cancelled"],
  planning: ["draft", "active", "cancelled"],
  active: ["review", "cancelled"],
  review: ["active", "completed", "cancelled"],
  completed: ["archived"],
  cancelled: ["archived"],
  archived: [],
};

const HYPOTHESIS_TRANSITIONS: Record<HypothesisStatus, readonly HypothesisStatus[]> = {
  proposed: ["testing"],
  testing: ["proposed", "supported", "contradicted", "inconclusive"],
  supported: ["testing"],
  contradicted: ["testing"],
  inconclusive: ["testing"],
};

const ANALYSIS_RUN_TRANSITIONS: Record<AnalysisRunStatus, readonly AnalysisRunStatus[]> = {
  queued: ["running", "cancelled"],
  running: ["succeeded", "failed", "cancelled"],
  succeeded: [],
  failed: [],
  cancelled: [],
};

export function canTransitionInvestigation(
  from: InvestigationStatus,
  to: InvestigationStatus,
): boolean {
  return INVESTIGATION_TRANSITIONS[from].includes(to);
}

export function canTransitionHypothesis(
  from: HypothesisStatus,
  to: HypothesisStatus,
): boolean {
  return HYPOTHESIS_TRANSITIONS[from].includes(to);
}

export function canTransitionAnalysisRun(
  from: AnalysisRunStatus,
  to: AnalysisRunStatus,
): boolean {
  return ANALYSIS_RUN_TRANSITIONS[from].includes(to);
}

/**
 * Returns blocking methodology issues for a claim.
 * An associational design must never be silently promoted to a causal claim.
 */
export function getClaimMethodologyIssues(
  claimKind: ClaimKind,
  methodology: ClaimMethodology,
): string[] {
  const issues: string[] = [];

  if (claimKind === "causal") {
    if (!methodology.exposure?.trim()) issues.push("causal-exposure-required");
    if (!methodology.outcome?.trim()) issues.push("causal-outcome-required");
    if (!methodology.identificationStrategy?.trim()) {
      issues.push("causal-identification-strategy-required");
    }
    if (methodology.assumptions.filter((item) => item.trim()).length === 0) {
      issues.push("causal-assumptions-required");
    }
    if (
      methodology.design === "observational" &&
      !methodology.confounderStrategy?.trim()
    ) {
      issues.push("causal-confounder-strategy-required");
    }
    if (
      methodology.design !== "observational" &&
      methodology.design !== "randomized-experiment" &&
      methodology.design !== "quasi-experiment"
    ) {
      issues.push("causal-design-inadequate");
    }
  }

  if (claimKind === "predictive") {
    if (methodology.design !== "predictive-evaluation") {
      issues.push("predictive-evaluation-design-required");
    }
    if (!methodology.outcome?.trim()) issues.push("predictive-outcome-required");
  }

  return issues;
}

function snapshotKey(ref: AnalysisRun["sourceRefs"][number]): string {
  return [
    ref.projectId,
    ref.sourceId,
    ref.assetId ?? "",
    ref.sourceVersion,
    ref.schemaFingerprint,
  ].join("|");
}

/**
 * Validates that analysis-derived evidence belongs to the exact successful
 * run and source snapshot that produced it.
 */
export function validateEvidenceAttachment(
  evidence: Evidence,
  run: AnalysisRun,
): string[] {
  const issues: string[] = [];

  if (evidence.origin.kind !== "analysis-run") {
    issues.push("evidence-origin-is-not-analysis-run");
    return issues;
  }

  if (evidence.origin.analysisRunId !== run.id) issues.push("analysis-run-id-mismatch");
  if (evidence.investigationId !== run.investigationId) {
    issues.push("investigation-id-mismatch");
  }
  if (evidence.hypothesisId && evidence.hypothesisId !== run.hypothesisId) {
    issues.push("hypothesis-id-mismatch");
  }
  if (run.status !== "succeeded") issues.push("analysis-run-not-succeeded");
  if (!run.resultHash?.trim()) issues.push("analysis-run-result-hash-missing");
  if (evidence.provenance.resultHash !== run.resultHash) {
    issues.push("evidence-result-hash-mismatch");
  }
  if (run.query && evidence.provenance.queryHash !== run.query.hash) {
    issues.push("evidence-query-hash-mismatch");
  }
  if (
    !evidence.provenance.computedAt.trim() ||
    Number.isNaN(Date.parse(evidence.provenance.computedAt))
  ) {
    issues.push("evidence-computed-at-invalid");
  }
  if (evidence.sourceRefs.length === 0) issues.push("evidence-source-reference-missing");

  const runSources = new Set(run.sourceRefs.map(snapshotKey));
  if (evidence.sourceRefs.some((ref) => !runSources.has(snapshotKey(ref)))) {
    issues.push("evidence-source-snapshot-not-in-analysis-run");
  }

  const evidenceFingerprints = new Set(evidence.provenance.schemaFingerprints);
  if (
    evidence.sourceRefs.some((ref) => !evidenceFingerprints.has(ref.schemaFingerprint))
  ) {
    issues.push("evidence-schema-fingerprint-missing");
  }

  if (
    evidence.provenance.engine &&
    (evidence.provenance.engine.name !== run.engine.name ||
      evidence.provenance.engine.version !== run.engine.version)
  ) {
    issues.push("evidence-engine-mismatch");
  }

  return issues;
}

/**
 * Approval is a human review action. Assistant-authored drafts require
 * an explicit reviewer, traceable evidence, and an outcome consistent with it.
 */
export function validateConclusionForApproval(
  conclusion: Conclusion,
  availableEvidence: readonly Evidence[],
  reviewerId: string,
): string[] {
  const issues: string[] = [];

  if (!reviewerId.trim()) issues.push("conclusion-reviewer-required");
  if (!conclusion.statement.trim()) issues.push("conclusion-statement-required");
  if (conclusion.evidenceIds.length === 0) issues.push("conclusion-evidence-required");

  const uniqueIds = new Set(conclusion.evidenceIds);
  if (uniqueIds.size !== conclusion.evidenceIds.length) {
    issues.push("conclusion-duplicate-evidence-reference");
  }

  const evidenceById = new Map(availableEvidence.map((item) => [item.id, item]));
  const cited = conclusion.evidenceIds
    .map((id) => evidenceById.get(id))
    .filter((item): item is Evidence => item !== undefined);

  if (cited.length !== conclusion.evidenceIds.length) {
    issues.push("conclusion-evidence-reference-missing");
  }
  if (cited.some((item) => item.investigationId !== conclusion.investigationId)) {
    issues.push("conclusion-cross-investigation-evidence");
  }
  if (cited.some((item) => item.assessment.level === "unassessed")) {
    issues.push("conclusion-contains-unassessed-evidence");
  }

  const hasSupporting = cited.some((item) => item.polarity === "supports");
  const hasContradicting = cited.some((item) => item.polarity === "contradicts");

  if (conclusion.outcome === "supported" && !hasSupporting) {
    issues.push("conclusion-supporting-evidence-required");
  }
  if (conclusion.outcome === "not-supported" && !hasContradicting) {
    issues.push("conclusion-contradicting-evidence-required");
  }
  if (
    conclusion.outcome === "partially-supported" &&
    (!hasSupporting || !hasContradicting)
  ) {
    issues.push("conclusion-mixed-evidence-required");
  }

  return issues;
}

export function validateInvestigationCompletion(input: {
  investigationId: string;
  runs: readonly AnalysisRun[];
  conclusions: readonly Conclusion[];
}): string[] {
  const issues: string[] = [];
  const runs = input.runs.filter((run) => run.investigationId === input.investigationId);
  const conclusions = input.conclusions.filter(
    (conclusion) => conclusion.investigationId === input.investigationId,
  );

  if (runs.some((run) => run.status === "queued" || run.status === "running")) {
    issues.push("investigation-has-active-analysis-runs");
  }

  if (
    !conclusions.some(
      (conclusion) =>
        conclusion.status === "approved" &&
        Boolean(conclusion.approvedBy?.trim()) &&
        Boolean(conclusion.approvedAt?.trim()),
    )
  ) {
    issues.push("investigation-approved-conclusion-required");
  }

  return issues;
}
