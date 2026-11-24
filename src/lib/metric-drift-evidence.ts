import {
  compareMetricDefinitionFingerprint,
  compareMetricOutputFingerprint,
  compareMetricSchemaFingerprint,
  compareMetricSourceIdentity,
  compareMetricContentFingerprint,
} from "@/lib/metric-definition-registry";
import { compareTransformationFingerprint } from "@/lib/transformation-fingerprint";
import type { EvidenceCheck } from "@/lib/unified-evidence";

type FingerprintStatus = "aligned" | "mismatch" | "insufficient-evidence";

export interface MetricDriftEvidenceInput {
  approved: {
    dataset: string;
    schemaFingerprint?: string;
    contentFingerprint?: string;
    transformationFingerprint?: string;
    outputFingerprint?: string;
    definitionFingerprint?: string;
  };
  active: {
    dataset: string | null;
    schemaFingerprint: string | null;
    contentFingerprint: string | null;
    transformationFingerprint: string | null;
    outputFingerprint: string | null;
    definitionFingerprint: string | null;
  };
  definitionValidation: {
    valid: boolean;
    issues?: string[];
  };
  execution: {
    status: FingerprintStatus;
    reason: string;
    revision?: string | number;
  };
}

/**
 * Compose the independent drift comparators into the exact evidence dimensions
 * consumed by the unified metric evaluator. A missing fingerprint is never
 * treated as a match, and a known definition mismatch outranks validation errors.
 */
export function buildMetricDriftEvidenceChecks(input: MetricDriftEvidenceInput): EvidenceCheck[] {
  const sourceIdentity = compareMetricSourceIdentity(input.approved.dataset, input.active.dataset);
  const schema = compareMetricSchemaFingerprint(
    input.approved.schemaFingerprint,
    input.active.schemaFingerprint,
  );
  const content = compareMetricContentFingerprint(
    input.approved.contentFingerprint,
    input.active.contentFingerprint,
  );
  const transformation = compareTransformationFingerprint(
    input.approved.transformationFingerprint,
    input.active.transformationFingerprint,
  );
  const output = compareMetricOutputFingerprint(
    input.approved.outputFingerprint,
    input.active.outputFingerprint,
  );
  const definition = compareMetricDefinitionFingerprint(
    input.approved.definitionFingerprint,
    input.active.definitionFingerprint,
  );

  return [
    { dimension: "source-identity", status: sourceIdentity.status, reason: sourceIdentity.reason },
    { dimension: "schema", status: schema.status, reason: schema.reason },
    { dimension: "content", status: content.status, reason: content.reason },
    { dimension: "transformation", status: transformation.status, reason: transformation.reason },
    { dimension: "execution", status: input.execution.status, reason: input.execution.reason,
      ...(input.execution.revision !== undefined ? { revision: input.execution.revision } : {}) },
    { dimension: "output", status: output.status, reason: output.reason },
    {
      dimension: "definition",
      status: definition.status === "mismatch"
        ? "mismatch"
        : !input.definitionValidation.valid
          ? "insufficient-evidence"
          : definition.status,
      reason: [
        definition.reason,
        ...(!input.definitionValidation.valid ? (input.definitionValidation.issues ?? []).slice(0, 4) : []),
      ].join(" "),
    },
  ];
}
