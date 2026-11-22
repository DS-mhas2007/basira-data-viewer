import type { CleanStep } from "@/lib/cleaning";

export const TRANSFORMATION_FINGERPRINT_PREFIX = "transform-v1:sha256:";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

/** Canonicalize JSON-compatible parameters without changing array order. */
function canonicalize(value: unknown): JsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Transformation parameters must contain finite numbers only.");
    return Object.is(value, -0) ? "-0" : value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    const result: Record<string, JsonValue> = {};
    for (const key of Object.keys(value).sort()) {
      const item = (value as Record<string, unknown>)[key];
      if (item !== undefined) result[key] = canonicalize(item);
    }
    return result;
  }
  throw new Error("Transformation parameters must be JSON-compatible.");
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Fingerprint the ordered transformation recipe independently of source content.
 * UI metadata (step id, label, affectedRows) is excluded; kind and parameters
 * are retained. This does not hash DuckDB's materialized output or prove that
 * every operation was successfully applied.
 */
export async function computeTransformationFingerprint(
  sourceContentFingerprint: string,
  steps: CleanStep[],
): Promise<string> {
  if (!/^content-v1:sha256:[0-9a-f]{64}$/.test(sourceContentFingerprint)) {
    throw new Error("A complete source content fingerprint is required.");
  }
  const recipe = steps.map((step) => ({
    kind: step.kind,
    params: canonicalize(step.params),
  }));
  const manifest = JSON.stringify([
    "transformation-recipe-v1",
    sourceContentFingerprint,
    recipe,
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(manifest));
  return TRANSFORMATION_FINGERPRINT_PREFIX + toHex(new Uint8Array(digest));
}

export type TransformationFingerprintCheck = {
  status: "aligned" | "mismatch" | "insufficient-evidence";
  reason: string;
};

export function compareTransformationFingerprint(
  approvedFingerprint: string | undefined,
  activeFingerprint: string | null,
): TransformationFingerprintCheck {
  const valid = (value: string | undefined | null): value is string =>
    typeof value === "string" && /^transform-v1:sha256:[0-9a-f]{64}$/.test(value);
  if (!valid(approvedFingerprint) || !valid(activeFingerprint)) {
    return {
      status: "insufficient-evidence",
      reason: "لا تتوفر بصمة وصف التحويل كاملة عند الاعتماد أو للمصدر النشط.",
    };
  }
  if (approvedFingerprint !== activeFingerprint) {
    return {
      status: "mismatch",
      reason: "تغيّر ترتيب عمليات التنظيف أو إعداداتها منذ اعتماد المقياس؛ راجع التعريف وأعد اعتماده.",
    };
  }
  return {
    status: "aligned",
    reason: "تطابقت بصمة وصف التحويل المرتّب مع النسخة المعتمدة.",
  };
}
