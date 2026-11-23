import { describe, expect, it } from "vitest";
import { evaluateUnifiedEvidence, type EvidenceCheck, type EvidenceDimension } from "./unified-evidence-engine";

const dimensions: EvidenceDimension[] = [
  "source-fingerprint",
  "schema-fingerprint",
  "transformation-recipe",
  "execution-attestation",
  "output-fingerprint",
  "lineage",
  "grain",
];

function check(dimension: EvidenceDimension, status: EvidenceCheck["status"] = "aligned"): EvidenceCheck {
  return {
    dimension,
    status,
    reason: `${dimension}: ${status}`,
    method: "unit-test",
    observedAt: "2026-11-23T00:00:00.000Z",
    revision: 3,
    reference: `test:${dimension}`,
    limitations: ["test evidence is synthetic"],
  };
}

describe("Unified Evidence Engine", () => {
  it("aligns only when every required independent dimension is aligned", () => {
    const result = evaluateUnifiedEvidence(dimensions.map((d) => check(d)), {
      requiredDimensions: dimensions,
    });
    expect(result.status).toBe("aligned");
    expect(result.checks).toHaveLength(dimensions.length);
    expect(result.checks[0]).toMatchObject({
      dimension: "source-fingerprint",
      method: "unit-test",
      revision: 3,
    });
  });

  it("returns mismatch when any required dimension conflicts", () => {
    const checks = dimensions.map((d) => check(d));
    checks[4] = check("output-fingerprint", "mismatch");
    expect(evaluateUnifiedEvidence(checks, { requiredDimensions: dimensions }).status).toBe("mismatch");
  });

  it("does not convert missing evidence into alignment", () => {
    const checks = dimensions.filter((d) => d !== "execution-attestation").map((d) => check(d));
    const result = evaluateUnifiedEvidence(checks, { requiredDimensions: dimensions });
    expect(result.status).toBe("insufficient-evidence");
    expect(result.reasons.join(" ")).toContain("execution-attestation");
  });

  it("preserves unsupported as a distinct outcome", () => {
    const checks = dimensions.map((d) => check(d));
    checks[5] = check("lineage", "unsupported");
    expect(evaluateUnifiedEvidence(checks, { requiredDimensions: dimensions }).status).toBe("unsupported");
  });

  it("uses mismatch precedence when both mismatch and unsupported evidence exist", () => {
    const checks = dimensions.map((d) => check(d));
    checks[1] = check("schema-fingerprint", "unsupported");
    checks[2] = check("transformation-recipe", "mismatch");
    expect(evaluateUnifiedEvidence(checks, { requiredDimensions: dimensions }).status).toBe("mismatch");
  });

  it("retains optional checks without requiring them for alignment", () => {
    const checks = dimensions.map((d) => check(d));
    checks.push(check("quality", "insufficient-evidence"));
    const result = evaluateUnifiedEvidence(checks, { requiredDimensions: dimensions });
    expect(result.status).toBe("aligned");
    expect(result.checks).toHaveLength(dimensions.length + 1);
  });

  it("treats duplicate required evidence as insufficient rather than selecting arbitrarily", () => {
    const checks = dimensions.map((d) => check(d));
    checks.push(check("grain"));
    const result = evaluateUnifiedEvidence(checks, { requiredDimensions: dimensions });
    expect(result.status).toBe("insufficient-evidence");
    expect(result.reasons.join(" ")).toContain("grain");
  });

  it("deduplicates limitations and records a deterministic evaluation timestamp when supplied", () => {
    const checks = dimensions.map((d) => check(d));
    const result = evaluateUnifiedEvidence(checks, {
      requiredDimensions: dimensions,
    }, "2026-11-23T12:00:00.000Z");
    expect(result.evaluatedAt).toBe("2026-11-23T12:00:00.000Z");
    expect(result.limitations).toEqual(["test evidence is synthetic"]);
  });
});
