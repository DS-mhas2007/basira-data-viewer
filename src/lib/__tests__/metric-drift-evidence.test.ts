import { describe, expect, it } from "vitest";
import { buildMetricDriftEvidenceChecks, type MetricDriftEvidenceInput } from "../metric-drift-evidence";
import { evaluateUnifiedEvidence } from "../unified-evidence";

const sha = (prefix: string, char: string) => `${prefix}:sha256:${char.repeat(64)}`;

const alignedInput = (): MetricDriftEvidenceInput => ({
  approved: {
    dataset: "orders",
    schemaFingerprint: "schema-v1:fnv1a64:0123456789abcdef",
    contentFingerprint: sha("content-v1", "a"),
    transformationFingerprint: sha("transform-v1", "b"),
    outputFingerprint: sha("output-v1", "c"),
    definitionFingerprint: sha("definition-v1", "d"),
  },
  active: {
    dataset: " ORDERS ",
    schemaFingerprint: "schema-v1:fnv1a64:0123456789abcdef",
    contentFingerprint: sha("content-v1", "a"),
    transformationFingerprint: sha("transform-v1", "b"),
    outputFingerprint: sha("output-v1", "c"),
    definitionFingerprint: sha("definition-v1", "d"),
  },
  definitionValidation: { valid: true },
  execution: { status: "aligned", reason: "Execution attestation matches.", revision: "2:4" },
});

describe("metric drift evidence composition", () => {
  it("emits one aligned check for every independent drift dimension", () => {
    const checks = buildMetricDriftEvidenceChecks(alignedInput());
    expect(checks.map((check) => check.dimension)).toEqual([
      "source-identity", "schema", "content", "transformation", "execution", "output", "definition",
    ]);
    expect(checks.every((check) => check.status === "aligned")).toBe(true);
    expect(checks.find((check) => check.dimension === "execution")?.revision).toBe("2:4");
    expect(evaluateUnifiedEvidence({ checks, required: checks.map((check) => check.dimension) }).status)
      .toBe("aligned");
  });

  it.each([
    ["source-identity", (input: MetricDriftEvidenceInput) => { input.active.dataset = "returns"; }],
    ["schema", (input: MetricDriftEvidenceInput) => { input.active.schemaFingerprint = "schema-v1:fnv1a64:fedcba9876543210"; }],
    ["content", (input: MetricDriftEvidenceInput) => { input.active.contentFingerprint = sha("content-v1", "e"); }],
    ["transformation", (input: MetricDriftEvidenceInput) => { input.active.transformationFingerprint = sha("transform-v1", "e"); }],
    ["output", (input: MetricDriftEvidenceInput) => { input.active.outputFingerprint = sha("output-v1", "e"); }],
    ["definition", (input: MetricDriftEvidenceInput) => { input.active.definitionFingerprint = sha("definition-v1", "e"); }],
  ])("preserves %s drift as a mismatch in the unified report", (dimension, mutate) => {
    const input = alignedInput();
    mutate(input);
    const checks = buildMetricDriftEvidenceChecks(input);
    expect(checks.find((check) => check.dimension === dimension)?.status).toBe("mismatch");
    expect(evaluateUnifiedEvidence({ checks, required: checks.map((check) => check.dimension) }).status)
      .toBe("mismatch");
  });

  it("fails closed when independent evidence is missing", () => {
    const input = alignedInput();
    input.active.dataset = null;
    input.active.schemaFingerprint = null;
    input.active.contentFingerprint = null;
    input.active.transformationFingerprint = null;
    input.active.outputFingerprint = null;
    input.active.definitionFingerprint = null;
    input.execution = { status: "insufficient-evidence", reason: "No attestation." };
    const checks = buildMetricDriftEvidenceChecks(input);
    expect(checks.every((check) => check.status === "insufficient-evidence")).toBe(true);
    expect(evaluateUnifiedEvidence({ checks, required: checks.map((check) => check.dimension) }).status)
      .toBe("insufficient-evidence");
  });

  it("keeps a known definition mismatch even when validation also fails", () => {
    const input = alignedInput();
    input.active.definitionFingerprint = sha("definition-v1", "e");
    input.definitionValidation = { valid: false, issues: ["Unknown source column."] };
    const definition = buildMetricDriftEvidenceChecks(input).find((check) => check.dimension === "definition");
    expect(definition?.status).toBe("mismatch");
    expect(definition?.reason).toContain("Unknown source column.");
  });

  it("marks a structurally invalid definition insufficient when no semantic drift is proven", () => {
    const input = alignedInput();
    input.definitionValidation = { valid: false, issues: ["Unknown source column."] };
    const definition = buildMetricDriftEvidenceChecks(input).find((check) => check.dimension === "definition");
    expect(definition?.status).toBe("insufficient-evidence");
  });
});
