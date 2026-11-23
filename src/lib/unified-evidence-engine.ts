/**
 * Unified Evidence Engine v1.
 *
 * Aggregates independently produced evidence without collapsing provenance into
 * a boolean. It evaluates only caller-declared required dimensions and preserves
 * each check's source, revision, timestamp, rationale, and limitations.
 */

export const UNIFIED_EVIDENCE_VERSION = 1 as const;

export type EvidenceStatus =
  | "aligned"
  | "mismatch"
  | "insufficient-evidence"
  | "unsupported";

export type EvidenceDimension =
  | "source-fingerprint"
  | "schema-fingerprint"
  | "transformation-recipe"
  | "execution-attestation"
  | "output-fingerprint"
  | "lineage"
  | "grain"
  | "quality";

export interface EvidenceCheck {
  dimension: EvidenceDimension;
  status: EvidenceStatus;
  reason: string;
  method: string;
  observedAt?: string;
  revision?: string | number;
  reference?: string;
  limitations: string[];
}

export interface EvidencePolicy {
  /** Dimensions that must be aligned before the aggregate can be aligned. */
  requiredDimensions: EvidenceDimension[];
}

export interface UnifiedEvidenceResult {
  version: typeof UNIFIED_EVIDENCE_VERSION;
  status: EvidenceStatus;
  evaluatedAt: string;
  requiredDimensions: EvidenceDimension[];
  checks: EvidenceCheck[];
  reasons: string[];
  limitations: string[];
}

const VALID_DIMENSIONS = new Set<EvidenceDimension>([
  "source-fingerprint",
  "schema-fingerprint",
  "transformation-recipe",
  "execution-attestation",
  "output-fingerprint",
  "lineage",
  "grain",
  "quality",
]);

const VALID_STATUSES = new Set<EvidenceStatus>([
  "aligned",
  "mismatch",
  "insufficient-evidence",
  "unsupported",
]);

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Deterministic precedence:
 * 1) mismatch — at least one required dimension conflicts with the active state;
 * 2) unsupported — a required dimension cannot be evaluated by this engine;
 * 3) insufficient-evidence — required evidence is missing or incomplete;
 * 4) aligned — every required dimension has a valid aligned check.
 *
 * Optional checks are retained for audit display but do not change the verdict.
 */
export function evaluateUnifiedEvidence(
  checks: EvidenceCheck[],
  policy: EvidencePolicy,
  evaluatedAt = new Date().toISOString(),
): UnifiedEvidenceResult {
  const requiredDimensions = unique(policy.requiredDimensions);
  const normalizedChecks = checks.map((check) => ({
    ...check,
    reason: isNonEmpty(check.reason) ? check.reason : "لم يُقدَّم سبب موثّق لهذه النتيجة.",
    method: isNonEmpty(check.method) ? check.method : "unspecified",
    limitations: Array.isArray(check.limitations)
      ? check.limitations.filter(isNonEmpty)
      : ["بيانات القيود غير مكتملة."],
  }));

  const reasons: string[] = [];
  const requiredChecks: EvidenceCheck[] = [];

  for (const dimension of requiredDimensions) {
    if (!VALID_DIMENSIONS.has(dimension)) {
      reasons.push(`بُعد دليل غير مدعوم في السياسة: ${String(dimension)}.`);
      continue;
    }

    const matches = normalizedChecks.filter((check) => check.dimension === dimension);
    if (matches.length !== 1) {
      const reason = matches.length === 0
        ? `الدليل المطلوب غير متوفر: ${dimension}.`
        : `توجد أدلة متعددة متضاربة أو مكررة للبُعد: ${dimension}.`;
      reasons.push(reason);
      requiredChecks.push({
        dimension,
        status: "insufficient-evidence",
        reason,
        method: "policy-evaluator",
        limitations: ["لم يتم اختيار دليل واحد بصورة حتمية."],
      });
      continue;
    }

    const check = matches[0]!;
    requiredChecks.push(check);
    if (!VALID_STATUSES.has(check.status) ||
        !isNonEmpty(check.reason) ||
        !isNonEmpty(check.method) ||
        !Array.isArray(check.limitations)) {
      reasons.push(`بيانات الدليل غير مكتملة أو غير صالحة: ${dimension}.`);
    } else if (check.status !== "aligned") {
      reasons.push(check.reason);
    }
  }

  const requiredStatuses = requiredChecks.map((check) => check.status);
  const hasMismatch = requiredStatuses.includes("mismatch");
  const hasUnsupported = requiredStatuses.includes("unsupported") || reasons.some((r) => r.startsWith("بُعد دليل غير مدعوم"));
  const hasInsufficient = requiredStatuses.includes("insufficient-evidence") ||
    requiredChecks.length !== requiredDimensions.length ||
    reasons.some((r) => r.includes("غير مكتملة") || r.includes("غير صالحة"));

  const status: EvidenceStatus = hasMismatch
    ? "mismatch"
    : hasUnsupported
      ? "unsupported"
      : hasInsufficient
        ? "insufficient-evidence"
        : "aligned";

  const limitations = unique(normalizedChecks.flatMap((check) => check.limitations));
  return {
    version: UNIFIED_EVIDENCE_VERSION,
    status,
    evaluatedAt,
    requiredDimensions,
    checks: normalizedChecks,
    reasons: unique(reasons.length ? reasons : ["جميع أبعاد الدليل المطلوبة متوافقة وفق السياسة المحددة."]),
    limitations,
  };
}
