import { describe, expect, it } from "vitest";
import {
  assessMetricAlignmentFromLineage,
  computeMetricSchemaFingerprint,
  compareMetricSchemaFingerprint,
  compareMetricContentFingerprint,
  compareMetricSourceIdentity,
  computeMetricDefinitionFingerprint,
  compareMetricDefinitionFingerprint,
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

describe("metric schema fingerprint", () => {
  it("is stable when column order or identifier casing changes", () => {
    const first = computeMetricSchemaFingerprint({ columns: [
      { name: "Revenue", type: "decimal(18,2)" },
      { name: "Month", type: "varchar" },
    ] });
    const reordered = computeMetricSchemaFingerprint({ columns: [
      { name: "month", type: "VARCHAR" },
      { name: "revenue", type: "DECIMAL(18, 2)" },
    ] });
    expect(first).toBe(reordered);
    expect(first).toMatch(/^schema-v1:fnv1a64:[0-9a-f]{16}$/);
  });

  it("changes when a column name or type changes", () => {
    const baseline = computeMetricSchemaFingerprint({ columns: [
      { name: "revenue", type: "DECIMAL(18,2)" },
      { name: "month", type: "VARCHAR" },
    ] });
    expect(computeMetricSchemaFingerprint({ columns: [
      { name: "net_revenue", type: "DECIMAL(18,2)" },
      { name: "month", type: "VARCHAR" },
    ] })).not.toBe(baseline);
    expect(computeMetricSchemaFingerprint({ columns: [
      { name: "revenue", type: "DOUBLE" },
      { name: "month", type: "VARCHAR" },
    ] })).not.toBe(baseline);
  });

  it("refuses empty, incomplete, or duplicate schemas", () => {
    expect(computeMetricSchemaFingerprint({ columns: [] })).toBeNull();
    expect(computeMetricSchemaFingerprint({ columns: [{ name: "revenue" }] })).toBeNull();
    expect(computeMetricSchemaFingerprint({ columns: [
      { name: "Revenue", type: "DOUBLE" },
      { name: "revenue", type: "DOUBLE" },
    ] })).toBeNull();
  });
});

describe("metric schema fingerprint comparison", () => {
  const fingerprint = "schema-v1:fnv1a64:0123456789abcdef";

  it("requires independent evidence on both sides", () => {
    expect(compareMetricSchemaFingerprint(undefined, fingerprint).status).toBe("insufficient-evidence");
    expect(compareMetricSchemaFingerprint(fingerprint, null).status).toBe("insufficient-evidence");
  });

  it("blocks changed schemas and allows exact fingerprint matches", () => {
    expect(compareMetricSchemaFingerprint(fingerprint, "schema-v1:fnv1a64:fedcba9876543210").status).toBe("mismatch");
    expect(compareMetricSchemaFingerprint(fingerprint, fingerprint).status).toBe("aligned");
  });
});

describe("metric source identity comparison", () => {
  it("matches aliases without treating case or surrounding whitespace as drift", () => {
    expect(compareMetricSourceIdentity(" Orders ", "orders").status).toBe("aligned");
  });

  it("detects a different active dataset alias", () => {
    const result = compareMetricSourceIdentity("orders", "orders_2026");
    expect(result.status).toBe("mismatch");
    expect(result.reason).toContain("لا يطابق");
  });

  it("fails closed when either side of the identity is absent", () => {
    expect(compareMetricSourceIdentity(undefined, "orders").status).toBe("insufficient-evidence");
    expect(compareMetricSourceIdentity("orders", null).status).toBe("insufficient-evidence");
    expect(compareMetricSourceIdentity(" ", "orders").status).toBe("insufficient-evidence");
  });
});

describe("metric content fingerprint comparison", () => {
  const fingerprint = `content-v1:sha256:${"a".repeat(64)}`;

  it("requires valid complete SHA-256 evidence on both sides", () => {
    expect(compareMetricContentFingerprint(undefined, fingerprint).status).toBe("insufficient-evidence");
    expect(compareMetricContentFingerprint(fingerprint, null).status).toBe("insufficient-evidence");
    expect(compareMetricContentFingerprint("content-v1:sha256:bad", fingerprint).status).toBe("insufficient-evidence");
  });

  it("detects changed data even when schema is unchanged", () => {
    const changed = `content-v1:sha256:${"b".repeat(64)}`;
    expect(compareMetricContentFingerprint(fingerprint, changed).status).toBe("mismatch");
    expect(compareMetricContentFingerprint(fingerprint, fingerprint).status).toBe("aligned");
  });
});

describe("approved metric definition fingerprint", () => {
  it("is stable for the same semantic definition and ignores approval metadata", async () => {
    const fingerprint = await computeMetricDefinitionFingerprint(definition);
    const metadataOnly = await computeMetricDefinitionFingerprint({
      ...definition,
      status: "draft",
      updatedAt: "2026-11-24T12:00:00.000Z",
      source: {
        ...definition.source,
        definitionFingerprint: fingerprint,
        outputFingerprint: `output-v1:sha256:${"c".repeat(64)}`,
      },
    });
    expect(metadataOnly).toBe(fingerprint);
    expect(fingerprint).toMatch(/^definition-v1:sha256:[0-9a-f]{64}$/);
  });

  it("changes when an approved semantic field changes", async () => {
    const baseline = await computeMetricDefinitionFingerprint(definition);
    const changed = await computeMetricDefinitionFingerprint({
      ...definition,
      formula: "SUM(net_revenue)",
    });
    expect(changed).not.toBe(baseline);
    expect(compareMetricDefinitionFingerprint(baseline, changed).status).toBe("mismatch");
  });

  it("detects case-sensitive changes inside formula string literals", async () => {
    const baseline = await computeMetricDefinitionFingerprint({
      ...definition,
      formula: "SUM(CASE WHEN status = 'A' THEN revenue END)",
    });
    const changedLiteral = await computeMetricDefinitionFingerprint({
      ...definition,
      formula: "SUM(CASE WHEN status = 'a' THEN revenue END)",
    });
    expect(changedLiteral).not.toBe(baseline);
  });

  it("requires a complete approved snapshot", () => {
    const fingerprint = `definition-v1:sha256:${"a".repeat(64)}`;
    expect(compareMetricDefinitionFingerprint(undefined, fingerprint).status).toBe("insufficient-evidence");
    expect(compareMetricDefinitionFingerprint(fingerprint, null).status).toBe("insufficient-evidence");
    expect(compareMetricDefinitionFingerprint(fingerprint, fingerprint).status).toBe("aligned");
  });
});

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
