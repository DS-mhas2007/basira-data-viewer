import type { CleanStep } from "@/lib/cleaning";
import { computeTransformationFingerprint } from "@/lib/transformation-fingerprint";

const SOURCE_FINGERPRINT = /^content-v1:sha256:[0-9a-f]{64}$/;
const OUTPUT_FINGERPRINT = /^output-v1:sha256:[0-9a-f]{64}$/;

export interface AuditSealSchemaColumn {
  name: string;
  type: string;
}

export interface AuditSealSourceIdentity {
  alias: string;
  contentFingerprint: string;
  sourceRevision: number;
  relationRevision: number;
}

export interface AuditSealOutputSnapshot {
  fingerprint: string;
  rowCount: number;
  schema: AuditSealSchemaColumn[];
  relationRevision: number;
  engineVersion: string;
}

export interface AuditSeal {
  status: "complete" | "incomplete";
  fileName: string;
  issuedAt: string;
  relationRevision: number | null;
  source: {
    alias: string | null;
    fingerprint: string | null;
    sourceRevision: number | null;
  };
  transformation: {
    fingerprint: string | null;
    steps: Array<{
      kind: CleanStep["kind"];
      label: string;
      affectedRows: number;
      parameters: CleanStep["params"];
    }>;
  };
  execution: {
    fingerprint: string;
    context: "client-side";
    engine: "DuckDB-WASM";
    engineVersion: string;
    sourceRevision: number;
    relationRevision: number;
    attestedAt: string;
  } | null;
  output: {
    fingerprint: string;
    rowCount: number;
    schema: AuditSealSchemaColumn[];
  } | null;
  issues: string[];
}

function snapshotSteps(steps: CleanStep[]): AuditSeal["transformation"]["steps"] {
  return steps.map((step) => ({
    kind: step.kind,
    label: step.label,
    affectedRows: step.affectedRows,
    parameters: structuredClone(step.params),
  }));
}

async function computeExecutionFingerprint(input: {
  source: AuditSealSourceIdentity;
  transformationFingerprint: string;
  output: AuditSealOutputSnapshot;
}): Promise<string> {
  const manifest = JSON.stringify([
    "client-execution-v1",
    "DuckDB-WASM",
    input.output.engineVersion,
    input.source.alias,
    input.source.contentFingerprint,
    input.source.sourceRevision,
    input.source.relationRevision,
    input.transformationFingerprint,
    input.output.fingerprint,
    input.output.rowCount,
    input.output.schema.map(({ name, type }) => [name, type.trim().replace(/\s+/g, " ").toUpperCase()]),
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(manifest));
  const hex = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `execution-v1:sha256:${hex}`;
}

export async function computeAuditSeal(params: {
  fileName: string;
  source: AuditSealSourceIdentity | null;
  sourceFingerprint: string | null;
  steps: CleanStep[];
  output: AuditSealOutputSnapshot | null;
  relationRevision?: number;
}): Promise<AuditSeal> {
  const issuedAt = new Date().toISOString();
  const issues: string[] = [];
  const source = params.source;
  const sourceFingerprint =
    source && SOURCE_FINGERPRINT.test(source.contentFingerprint) &&
    source.contentFingerprint === params.sourceFingerprint &&
    source.alias.trim() &&
    Number.isSafeInteger(source.sourceRevision) &&
    source.sourceRevision >= 0 &&
    Number.isSafeInteger(source.relationRevision) &&
    source.relationRevision >= 0
      ? source.contentFingerprint
      : null;

  if (!sourceFingerprint || !source) {
    issues.push("تعذّر مطابقة بصمة الورقة الأصلية مع هوية المصدر النشط.");
  }

  let transformationFingerprint: string | null = null;
  if (sourceFingerprint) {
    try {
      transformationFingerprint = await computeTransformationFingerprint(sourceFingerprint, params.steps);
    } catch {
      issues.push("تعذّر حساب بصمة وصف التحويل.");
    }
  }

  const output = params.output;
  const outputIsValid = !!output &&
    OUTPUT_FINGERPRINT.test(output.fingerprint) &&
    Number.isSafeInteger(output.rowCount) &&
    output.rowCount >= 0 &&
    Number.isSafeInteger(output.relationRevision) &&
    output.relationRevision >= 0 &&
    output.schema.length > 0 &&
    output.schema.every((column) => column.name.trim() && column.type.trim()) &&
    !!output.engineVersion.trim();

  if (!outputIsValid) {
    issues.push("تعذّر إنشاء بصمة ومخطط وعدد صفوف صالحين للناتج النشط.");
  } else if (output && params.relationRevision !== undefined &&
      output.relationRevision !== params.relationRevision) {
    issues.push("تغيّرت العلاقة النشطة منذ التقاط نسخة الناتج.");
  } else if (output && source && output.relationRevision !== source.relationRevision) {
    issues.push("تغيّرت العلاقة النشطة أثناء حساب بصمة الناتج.");
  }
  const outputMatchesSource = !!output && outputIsValid &&
    (params.relationRevision === undefined || output.relationRevision === params.relationRevision) &&
    (!source || output.relationRevision === source.relationRevision);

  let executionFingerprint: string | null = null;
  if (source && sourceFingerprint && transformationFingerprint && output && outputMatchesSource) {
    try {
      executionFingerprint = await computeExecutionFingerprint({
        source,
        transformationFingerprint,
        output,
      });
    } catch {
      issues.push("تعذّر حساب بصمة سجل التنفيذ المحلي.");
    }
  }

  if (source && sourceFingerprint && transformationFingerprint && output && outputMatchesSource && executionFingerprint) {
    return {
      status: "complete",
      fileName: params.fileName,
      issuedAt,
      relationRevision: output.relationRevision,
      source: {
        alias: source.alias,
        fingerprint: sourceFingerprint,
        sourceRevision: source.sourceRevision,
      },
      transformation: {
        fingerprint: transformationFingerprint,
        steps: snapshotSteps(params.steps),
      },
      execution: {
        fingerprint: executionFingerprint,
        context: "client-side",
        engine: "DuckDB-WASM",
        engineVersion: output.engineVersion,
        sourceRevision: source.sourceRevision,
        relationRevision: source.relationRevision,
        attestedAt: issuedAt,
      },
      output: {
        fingerprint: output.fingerprint,
        rowCount: output.rowCount,
        schema: output.schema.map((column) => ({ ...column })),
      },
      issues: [],
    };
  }

  return {
    status: "incomplete",
    fileName: params.fileName,
    issuedAt,
    relationRevision: params.relationRevision ?? output?.relationRevision ?? source?.relationRevision ?? null,
    source: {
      alias: source?.alias ?? null,
      fingerprint: sourceFingerprint,
      sourceRevision: source && Number.isSafeInteger(source.sourceRevision) ? source.sourceRevision : null,
    },
    transformation: {
      fingerprint: transformationFingerprint,
      steps: snapshotSteps(params.steps),
    },
    execution: null,
    output: output && outputMatchesSource
      ? {
          fingerprint: output.fingerprint,
          rowCount: output.rowCount,
          schema: output.schema.map((column) => ({ ...column })),
        }
      : null,
    issues: issues.length ? issues : ["الأدلة المتاحة غير كافية لإنشاء سجل اتساق كامل."],
  };
}

export async function computeAuditSealIfCurrent(
  params: Parameters<typeof computeAuditSeal>[0],
  isCurrent: () => boolean,
): Promise<AuditSeal | null> {
  const seal = await computeAuditSeal(params);
  return isCurrent() ? seal : null;
}

export function createIncompleteAuditSeal(input: {
  fileName: string;
  source?: AuditSealSourceIdentity | null;
  sourceFingerprint?: string | null;
  steps: CleanStep[];
  reason: string;
  relationRevision?: number;
}): AuditSeal {
  const source = input.source ?? null;
  const sourceFingerprint = source &&
    SOURCE_FINGERPRINT.test(source.contentFingerprint) &&
    source.contentFingerprint === input.sourceFingerprint
      ? source.contentFingerprint
      : null;
  return {
    status: "incomplete",
    fileName: input.fileName,
    issuedAt: new Date().toISOString(),
    relationRevision: input.relationRevision ?? source?.relationRevision ?? null,
    source: {
      alias: source?.alias ?? null,
      fingerprint: sourceFingerprint,
      sourceRevision: source && Number.isSafeInteger(source.sourceRevision) ? source.sourceRevision : null,
    },
    transformation: {
      fingerprint: null,
      steps: snapshotSteps(input.steps),
    },
    execution: null,
    output: null,
    issues: [input.reason],
  };
}

export function isAuditSealSourceCurrent(
  expected: AuditSealSourceIdentity | null,
  current: AuditSealSourceIdentity | null,
): boolean {
  return !!expected && !!current &&
    expected.alias === current.alias &&
    expected.contentFingerprint === current.contentFingerprint &&
    expected.sourceRevision === current.sourceRevision &&
    expected.relationRevision === current.relationRevision;
}

export function sealTimestampAr(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
  const time = d.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${date} — ${time}`;
}
