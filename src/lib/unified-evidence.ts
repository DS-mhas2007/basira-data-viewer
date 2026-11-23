/**
 * Unified Evidence Engine v1.
 *
 * Aggregates independent evidence dimensions without collapsing them into a
 * boolean or confidence score. The evaluator is deterministic and conservative:
 * missing evidence never passes, mismatches are explicit, and unsupported
 * verification remains distinct from absent evidence.
 */

export const UNIFIED_EVIDENCE_VERSION = "unified-evidence-v1" as const;

export const REQUIRED_EVIDENCE_DIMENSIONS = [
  "source-content",
  "schema",
  "transformation",
  "execution",
  "output",
  "lineage",
  "grain",
  "quality",
] as const;

export type EvidenceDimension = (typeof REQUIRED_EVIDENCE_DIMENSIONS)[number];
export type EvidenceStatus =
  | "aligned"
  | "mismatch"
  | "insufficient-evidence"
  | "unsupported";

export interface EvidenceCheck {
  dimension: EvidenceDimension;
  status: EvidenceStatus;
  reason: string;
  observedAt?: string;
  evidenceRef?: string;
  revision?: number;
}

export interface UnifiedEvidenceInput {
  subjectId: string;
  checks: EvidenceCheck[];
  evaluatedAt?: string;
}

export interface UnifiedEvidenceResult {
  version: typeof UNIFIED_EVIDENCE_VERSION;
  subjectId: string;
  status: EvidenceStatus;
  evaluatedAt: string;
  checks: EvidenceCheck[];
  reasons: string[];
}

/** Fixed ordering makes serialized reports and snapshots stable across callers. */
const DIMENSION_ORDER = new Map<EvidenceDimension, number>(
  REQUIRED_EVIDENCE_DIMENSIONS.map((dimension, index) => [dimension, index]),
);

/** A mismatch is a concrete contradiction; unsupported and missing are not contradictions. */
function resolveStatus(checks: EvidenceCheck[]): EvidenceStatus {
  if (checks.some((check) => check.status === "mismatch")) return "mismatch";
  if (checks.some((check) => check.status === "unsupported")) return "unsupported";
  if (checks.some((check) => check.status === "insufficient-evidence")) {
    return "insufficient-evidence";
  }
  return "aligned";
}

function isEvidenceStatus(value: unknown): value is EvidenceStatus {
  return value === "aligned" ||
    value === "mismatch" ||
    value === "insufficient-evidence" ||
    value === "unsupported";
}

/**
 * Evaluate a complete evidence set.
 *
 * Every required dimension must be present exactly once. Duplicate or malformed
 * checks are converted into explicit unsupported evidence; missing dimensions
 * become insufficient-evidence. No dimension can be silently treated as N/A.
 */
export function evaluateUnifiedEvidence(
  input: UnifiedEvidenceInput,
): UnifiedEvidenceResult {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const subjectId = typeof input.subjectId === "string" ? input.subjectId.trim() : "";

  if (!subjectId) {
    const reason = "لا يمكن تقييم الأدلة دون معرّف واضح للعنصر محل التقييم.";
    const checks: EvidenceCheck[] = REQUIRED_EVIDENCE_DIMENSIONS.map((dimension) => ({
      dimension,
      status: "unsupported",
      reason,
    }));
    return {
      version: UNIFIED_EVIDENCE_VERSION,
      subjectId: "",
      status: "unsupported",
      evaluatedAt,
      checks,
      reasons: [reason],
    };
  }

  const grouped = new Map<EvidenceDimension, EvidenceCheck[]>();
  const globalIssues: string[] = [];

  for (const raw of Array.isArray(input.checks) ? input.checks : []) {
    const dimension = raw?.dimension;
    if (!DIMENSION_ORDER.has(dimension)) {
      globalIssues.push("توجد نتيجة فحص ببُعد أدلة غير معروف؛ لا يمكن تجاهلها بأمان.");
      continue;
    }
    const list = grouped.get(dimension) ?? [];
    list.push(raw);
    grouped.set(dimension, list);
  }

  const checks: EvidenceCheck[] = REQUIRED_EVIDENCE_DIMENSIONS.map((dimension) => {
    const candidates = grouped.get(dimension) ?? [];
    if (candidates.length === 0) {
      return {
        dimension,
        status: "insufficient-evidence",
        reason: `لا يتوفر دليل مطلوب لبُعد ${dimension}.`,
      };
    }
    if (candidates.length > 1) {
      return {
        dimension,
        status: "unsupported",
        reason: `وصلت عدة نتائج متعارضة أو مكررة لبُعد ${dimension}؛ يلزم مصدر واحد حاسم.`,
      };
    }

    const candidate = candidates[0]!;
    if (
      !isEvidenceStatus(candidate.status) ||
      typeof candidate.reason !== "string" ||
      candidate.reason.trim().length === 0 ||
      (candidate.revision !== undefined &&
        (!Number.isSafeInteger(candidate.revision) || candidate.revision < 0))
    ) {
      return {
        dimension,
        status: "unsupported",
        reason: `بيانات فحص ${dimension} غير صالحة أو لا تحتوي تفسيراً قابلاً للمراجعة.`,
      };
    }
    return { ...candidate, reason: candidate.reason.trim() };
  });

  if (globalIssues.length > 0) {
    checks.push({
      dimension: "quality",
      status: "unsupported",
      reason: globalIssues.join(" "),
    });
  }

  const status = resolveStatus(checks);
  const reasons = checks
    .filter((check) => check.status !== "aligned")
    .map((check) => `[${check.dimension}] ${check.reason}`);

  return {
    version: UNIFIED_EVIDENCE_VERSION,
    subjectId,
    status,
    evaluatedAt,
    checks,
    reasons,
  };
}
