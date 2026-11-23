import { describe, expect, it } from "vitest";
import { evaluateUnifiedEvidence, type EvidenceCheck } from "./unified-evidence";

const required = ["source-identity", "schema", "content"] as const;
const aligned = (dimension: EvidenceCheck["dimension"]): EvidenceCheck => ({
  dimension,
  status: "aligned",
  reason: "matched",
});

describe("unified evidence evaluator", () => {
  it("aligns only when every required dimension is present and aligned", () => {
    const report = evaluateUnifiedEvidence({
      required: [...required],
      checks: required.map(aligned),
      evaluatedAt: "2026-11-23T00:00:00.000Z",
    });
    expect(report.status).toBe("aligned");
    expect(report.policy.missing).toEqual([]);
  });

  it("fails closed when a required dimension is missing", () => {
    const report = evaluateUnifiedEvidence({
      required: [...required],
      checks: [aligned("source-identity"), aligned("schema")],
    });
    expect(report.status).toBe("insufficient-evidence");
    expect(report.policy.missing).toEqual(["content"]);
  });

  it("gives mismatch precedence over missing or unsupported evidence", () => {
    const report = evaluateUnifiedEvidence({
      required: [...required],
      checks: [
        aligned("source-identity"),
        { dimension: "schema", status: "mismatch", reason: "schema drift" },
        { dimension: "content", status: "unsupported", reason: "not measurable" },
      ],
    });
    expect(report.status).toBe("mismatch");
    expect(report.reasons).toContain("[schema] schema drift");
  });

  it("preserves unsupported as a distinct status", () => {
    const report = evaluateUnifiedEvidence({
      required: [...required],
      checks: [
        aligned("source-identity"),
        aligned("schema"),
        { dimension: "content", status: "unsupported", reason: "unsupported format" },
      ],
    });
    expect(report.status).toBe("unsupported");
  });

  it("rejects duplicate evidence dimensions instead of choosing one silently", () => {
    const report = evaluateUnifiedEvidence({
      required: [...required],
      checks: [
        aligned("source-identity"),
        aligned("schema"),
        aligned("content"),
        { dimension: "schema", status: "aligned", reason: "second schema result" },
      ],
    });
    expect(report.status).toBe("insufficient-evidence");
    expect(report.policy.duplicates).toEqual(["schema"]);
  });
});
