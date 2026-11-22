import { describe, expect, it } from "vitest";
import {
  assessMetricAlignmentFromLineage,
  type MetricDefinition,
  type MetricLineageEvidence,
} from "../metric-definition-registry";

const definition: MetricDefinition = {
  id: "gross_revenue",
  name: "Gross revenue",
  description: "Revenue aggregated by month.",
  formula: "SUM(revenue)",
  sourceColumns: ["revenue"],
  grain: ["month"],
  filters: [],
  exclusions: [],
  unit: "USD",
  expectedDomain: { kind: "numeric", min: 0 },
  assumptions: ["Revenue is recorded in USD."],
  limitations: [],
  source: { dataset: "orders", version: "v1" },
  status: "approved",
  updatedAt: "2026-11-22T00:00:00.000Z",
};

const completeLineage: MetricLineageEvidence = {
  status: "complete",
  outputColumns: [{
    outputName: "gross_revenue",
    expression: "SUM(revenue)",
    sourceColumns: ["revenue"],
    role: "metric",
    confidence: "high",
  }],
};

describe("metric alignment lineage gate", () => {
  it("aligns only with complete lineage, a high-confidence metric output and verified grain", () => {
    expect(assessMetricAlignmentFromLineage(definition, completeLineage, ["month"]).status)
      .toBe("aligned");
  });

  it("never aligns when lineage is partial or unsupported", () => {
    for (const status of ["partial", "unsupported"] as const) {
      expect(assessMetricAlignmentFromLineage(
        definition,
        { ...completeLineage, status },
        ["month"],
      ).status).toBe("insufficient-evidence");
    }
  });

  it("requires independently verified non-empty grain", () => {
    expect(assessMetricAlignmentFromLineage(definition, completeLineage).status)
      .toBe("insufficient-evidence");
    expect(assessMetricAlignmentFromLineage(definition, completeLineage, []).status)
      .toBe("insufficient-evidence");
  });

  it("rejects ambiguous matching output expressions", () => {
    const duplicate: MetricLineageEvidence = {
      ...completeLineage,
      outputColumns: [
        ...completeLineage.outputColumns,
        { ...completeLineage.outputColumns[0]!, outputName: "another_metric" },
      ],
    };
    expect(assessMetricAlignmentFromLineage(definition, duplicate, ["month"]).status)
      .toBe("insufficient-evidence");
  });

  it("requires a high-confidence metric role and known source dependencies", () => {
    const lowConfidence: MetricLineageEvidence = {
      ...completeLineage,
      outputColumns: [{ ...completeLineage.outputColumns[0]!, confidence: "medium" }],
    };
    const noDependencies: MetricLineageEvidence = {
      ...completeLineage,
      outputColumns: [{ ...completeLineage.outputColumns[0]!, sourceColumns: [] }],
    };
    expect(assessMetricAlignmentFromLineage(definition, lowConfidence, ["month"]).status)
      .toBe("insufficient-evidence");
    expect(assessMetricAlignmentFromLineage(definition, noDependencies, ["month"]).status)
      .toBe("insufficient-evidence");
  });

  it("reports a real dependency or grain mismatch instead of aligned", () => {
    const differentSource: MetricLineageEvidence = {
      ...completeLineage,
      outputColumns: [{ ...completeLineage.outputColumns[0]!, sourceColumns: ["net_revenue"] }],
    };
    expect(assessMetricAlignmentFromLineage(definition, differentSource, ["month"]).status)
      .toBe("mismatch");
    expect(assessMetricAlignmentFromLineage(definition, completeLineage, ["day"]).status)
      .toBe("mismatch");
  });
});
