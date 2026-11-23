export type EvidenceStatus = "aligned" | "mismatch" | "insufficient-evidence" | "unsupported";

export type EvidenceDimension =
  | "source-identity"
  | "schema"
  | "content"
  | "transformation"
  | "execution"
  | "output"
  | "definition"
  | "lineage"
  | "grain"
  | "quality";

export interface EvidenceCheck {
  dimension: EvidenceDimension;
  status: EvidenceStatus;
  reason: string;
  observedAt?: string;
  revision?: string | number;
  details?: Record<string, string | number | boolean | null>;
}

export interface UnifiedEvidenceReport {
  version: "evidence-v1";
  status: EvidenceStatus;
  checks: EvidenceCheck[];
  reasons: string[];
  evaluatedAt: string;
  policy: {
    required: EvidenceDimension[];
    missing: EvidenceDimension[];
    duplicates: EvidenceDimension[];
  };
}

export const DEFAULT_METRIC_EVIDENCE_POLICY: EvidenceDimension[] = [
  "source-identity",
  "schema",
  "content",
  "transformation",
  "execution",
  "output",
  "definition",
  "lineage",
  "grain",
];

/**
 * Deterministic, explainable evidence aggregation.
 * Missing/duplicate required dimensions never pass. A mismatch dominates
 * insufficient evidence; unsupported is kept explicit when no mismatch exists.
 */
export function evaluateUnifiedEvidence(input: {
  checks: EvidenceCheck[];
  required?: EvidenceDimension[];
  evaluatedAt?: string;
}): UnifiedEvidenceReport {
  const required = [...(input.required ?? DEFAULT_METRIC_EVIDENCE_POLICY)];
  const counts = new Map<EvidenceDimension, number>();
  for (const check of input.checks) {
    counts.set(check.dimension, (counts.get(check.dimension) ?? 0) + 1);
  }
  const missing = required.filter((dimension) => !counts.has(dimension));
  const duplicates = required.filter((dimension) => (counts.get(dimension) ?? 0) > 1);
  const normalizedChecks = input.checks.map((check) => ({ ...check }));
  for (const dimension of missing) {
    normalizedChecks.push({
      dimension,
      status: "insufficient-evidence",
      reason: `لم يُقدَّم دليل مطلوب لبعد: ${dimension}.`,
    });
  }
  for (const dimension of duplicates) {
    normalizedChecks.push({
      dimension,
      status: "insufficient-evidence",
      reason: `قُدّمت أدلة متعارضة أو مكررة لبعد: ${dimension}؛ يلزم مصدر قرار واحد واضح.`,
    });
  }

  const statuses = normalizedChecks.map((check) => check.status);
  const status: EvidenceStatus = statuses.includes("mismatch")
    ? "mismatch"
    : statuses.includes("unsupported")
      ? "unsupported"
      : statuses.includes("insufficient-evidence")
        ? "insufficient-evidence"
        : "aligned";
  const reasons = normalizedChecks
    .filter((check) => check.status !== "aligned")
    .map((check) => `[${check.dimension}] ${check.reason}`);
  if (status === "aligned") reasons.push("اكتملت جميع أبعاد الأدلة المطلوبة وتوافقت.");
  return {
    version: "evidence-v1",
    status,
    checks: normalizedChecks,
    reasons,
    evaluatedAt: input.evaluatedAt ?? new Date().toISOString(),
    policy: { required, missing, duplicates },
  };
}
