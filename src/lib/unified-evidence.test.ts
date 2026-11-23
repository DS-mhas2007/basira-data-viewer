import { describe, expect, it } from "vitest";
import {
  evaluateUnifiedEvidence,
  REQUIRED_EVIDENCE_DIMENSIONS,
  type EvidenceCheck,
} from "@/lib/unified-evidence";

const alignedChecks = (): EvidenceCheck[] =>
  REQUIRED_EVIDENCE_DIMENSIONS.map((dimension) => ({
    dimension,
    status: "aligned",
    reason: `Verified ${dimension}`,
    observedAt: "2026-11-23T08:00:00.000Z",
  }));

describe("evaluateUnifiedEvidence", () => {
  it("aligns only when every required evidence dimension is aligned", () => {
    const result = evaluateUnifiedEvidence({
      subjectId: "metric:monthly-revenue",
      evaluatedAt: "2026-11-23T08:00:00.000Z",
      checks: alignedChecks(),
    });

    expect(result.status).toBe("aligned");
    expect(result.reasons).toEqual([]);
    expect(result.checks.map((check) => check.dimension)).toEqual(REQUIRED_EVIDENCE_DIMENSIONS);
  });

  it("prioritizes a concrete mismatch over missing evidence", () => {
    const checks = alignedChecks().filter((check) => check.dimension !== "quality");
    checks.find((check) => check.dimension === "output")!.status = "mismatch";
    checks.find((check) => check.dimension === "output")!.reason = "Output hash changed";

    const result = evaluateUnifiedEvidence({ subjectId: "metric:test", checks });

    expect(result.status).toBe("mismatch");
    expect(result.reasons).toContain("[output] Output hash changed");
    expect(result.reasons.some((reason) => reason.includes("[quality]"))).toBe(true);
  });

  it("keeps unsupported evidence distinct from insufficient evidence", () => {
    const checks = alignedChecks();
    const lineage = checks.find((check) => check.dimension === "lineage")!;
    lineage.status = "unsupported";
    lineage.reason = "SQL construct requires an AST parser";

    const result = evaluateUnifiedEvidence({ subjectId: "metric:test", checks });

    expect(result.status).toBe("unsupported");
    expect(result.reasons).toContain(
      "[lineage] SQL construct requires an AST parser",
    );
  });

  it("does not pass when a required dimension is missing", () => {
    const checks = alignedChecks().filter((check) => check.dimension !== "grain");
    const result = evaluateUnifiedEvidence({ subjectId: "metric:test", checks });

    expect(result.status).toBe("insufficient-evidence");
    expect(result.checks.find((check) => check.dimension === "grain")).toMatchObject({
      status: "insufficient-evidence",
      reason: "لا يتوفر دليل مطلوب لبُعد grain.",
    });
  });

  it("rejects duplicate checks instead of choosing one silently", () => {
    const checks = alignedChecks();
    checks.push({ ...checks[0]! });
    const result = evaluateUnifiedEvidence({ subjectId: "metric:test", checks });

    expect(result.status).toBe("unsupported");
    expect(result.checks[0]).toMatchObject({ status: "unsupported" });
  });

  it("rejects malformed checks without a reviewable reason", () => {
    const checks = alignedChecks();
    const schema = checks.find((check) => check.dimension === "schema")!;
    schema.reason = "   ";

    const result = evaluateUnifiedEvidence({ subjectId: "metric:test", checks });

    expect(result.status).toBe("unsupported");
    expect(result.checks.find((check) => check.dimension === "schema")?.reason)
      .toContain("غير صالحة");
  });

  it("requires a subject identifier", () => {
    const result = evaluateUnifiedEvidence({ subjectId: " ", checks: alignedChecks() });

    expect(result.status).toBe("unsupported");
    expect(result.subjectId).toBe("");
  });

  it("produces deterministic dimension ordering regardless of input order", () => {
    const checks = alignedChecks().reverse();
    const result = evaluateUnifiedEvidence({
      subjectId: "metric:test",
      evaluatedAt: "2026-11-23T08:00:00.000Z",
      checks,
    });

    expect(result.checks.map((check) => check.dimension)).toEqual(REQUIRED_EVIDENCE_DIMENSIONS);
  });
});
