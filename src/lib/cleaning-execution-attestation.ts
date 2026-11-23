import type { CleanStep } from "@/lib/cleaning";
import { computeTransformationFingerprint } from "@/lib/transformation-fingerprint";

export const EXECUTION_ATTESTATION_PREFIX = "execution-v1";

export interface ActiveSourceIdentity {
  alias: string;
  contentFingerprint: string;
  sourceRevision: number;
  relationRevision: number;
}

export interface CleaningExecutionAttestation {
  version: typeof EXECUTION_ATTESTATION_PREFIX;
  sourceAlias: string;
  sourceContentFingerprint: string;
  sourceRevision: number;
  relationRevision: number;
  transformationFingerprint: string;
  outputFingerprint: string;
  attestedAt: string;
}

export interface ExecutionAttestationCheck {
  status: "aligned" | "mismatch" | "insufficient-evidence";
  reason: string;
}

let currentAttestation: CleaningExecutionAttestation | null = null;
let attestationGeneration = 0;

/** Clear stale proof before any attempt to replace the active DuckDB relation. */
export function clearCleaningExecutionAttestation(): void {
  attestationGeneration += 1;
  currentAttestation = null;
}

/** Snapshot invalidation state before output hashing; prevents stale hashes being re-attested. */
export function getCleaningExecutionAttestationGeneration(): number {
  return attestationGeneration;
}

/** Call only after DuckDB has successfully materialized the requested relation. */
export async function recordCleaningExecutionAttestation(input: {
  source: ActiveSourceIdentity | null;
  steps: CleanStep[];
  outputFingerprint: string;
  expectedGeneration: number;
}): Promise<CleaningExecutionAttestation | null> {
  const generationAtStart = input.expectedGeneration;
  if (generationAtStart !== attestationGeneration) return null;
  if (
    !input.source?.alias.trim() ||
    !/^content-v1:sha256:[0-9a-f]{64}$/.test(input.source.contentFingerprint) ||
    !Number.isSafeInteger(input.source.relationRevision) ||
    input.source.relationRevision < 0 ||
    !Number.isSafeInteger(input.source.sourceRevision) ||
    input.source.sourceRevision < 0 ||
    !/^output-v1:sha256:[0-9a-f]{64}$/.test(input.outputFingerprint)
  ) {
    clearCleaningExecutionAttestation();
    return null;
  }

  const transformationFingerprint = await computeTransformationFingerprint(
    input.source.contentFingerprint,
    input.steps,
  );
  if (generationAtStart !== attestationGeneration) return null;
  currentAttestation = {
    version: EXECUTION_ATTESTATION_PREFIX,
    sourceAlias: input.source.alias,
    sourceContentFingerprint: input.source.contentFingerprint,
    sourceRevision: input.source.sourceRevision,
    relationRevision: input.source.relationRevision,
    transformationFingerprint,
    outputFingerprint: input.outputFingerprint,
    attestedAt: new Date().toISOString(),
  };
  return { ...currentAttestation };
}

export function getCleaningExecutionAttestation(): CleaningExecutionAttestation | null {
  return currentAttestation ? { ...currentAttestation } : null;
}

/** Compare the last successful materialization with the live source, recipe and output. */
export async function compareCleaningExecutionAttestation(input: {
  source: ActiveSourceIdentity | null;
  steps: CleanStep[];
  outputFingerprint: string | null;
}): Promise<ExecutionAttestationCheck> {
  const proof = currentAttestation;
  const generationAtStart = attestationGeneration;
  if (!proof || !input.source || !input.outputFingerprint) {
    return {
      status: "insufficient-evidence",
      reason: "لا يوجد إثبات تنفيذ ناجح مرتبط بالمصدر والوصفة والناتج النشط.",
    };
  }
  if (proof.sourceAlias !== input.source.alias) {
    return {
      status: "mismatch",
      reason: "تغيّر مصدر البيانات منذ آخر تنفيذ موثّق؛ أعد تطبيق خطوات التنظيف على المصدر الحالي.",
    };
  }
  if (proof.sourceRevision !== input.source.sourceRevision) {
    return {
      status: "mismatch",
      reason: "أُعيد تفعيل المصدر منذ آخر تنفيذ موثّق؛ أعد تطبيق الوصفة لإثبات التنفيذ على النسخة النشطة.",
    };
  }
  if (proof.relationRevision !== input.source.relationRevision) {
    return { status: "mismatch", reason: "تغيّرت العلاقة النشطة منذ آخر تنفيذ موثّق؛ أعد تطبيق خطوات التنظيف." };
  }
  if (proof.sourceContentFingerprint !== input.source.contentFingerprint) {
    return {
      status: "mismatch",
      reason: "تغيّر محتوى المصدر منذ آخر تنفيذ موثّق.",
    };
  }
  let currentRecipe: string;
  try {
    currentRecipe = await computeTransformationFingerprint(input.source.contentFingerprint, input.steps);
  } catch {
    return {
      status: "insufficient-evidence",
      reason: "تعذّر حساب بصمة وصفة التنظيف الحالية.",
    };
  }
  if (generationAtStart !== attestationGeneration || currentAttestation !== proof) {
    return { status: "insufficient-evidence", reason: "تغيّر المصدر أو الناتج أثناء التحقق؛ أعد المحاولة بعد استقرار التنفيذ." };
  }
  if (proof.transformationFingerprint !== currentRecipe) {
    return {
      status: "mismatch",
      reason: "الوصفة المعلنة لا تطابق آخر وصفة نُفّذت بنجاح؛ طبّق الخطوات الحالية قبل الاعتماد أو المطابقة.",
    };
  }
  if (proof.outputFingerprint !== input.outputFingerprint) {
    return {
      status: "mismatch",
      reason: "الناتج الفعلي في DuckDB تغيّر منذ آخر تنفيذ موثّق.",
    };
  }
  return {
    status: "aligned",
    reason: "تطابق المصدر والوصفة والناتج مع آخر تنفيذ ناجح موثّق.",
  };
}
