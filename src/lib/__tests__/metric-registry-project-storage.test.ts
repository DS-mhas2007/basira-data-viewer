import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import type { MetricDefinition } from "../metric-definition-registry";
import {
  clearProjectMetricDefinitions,
  loadProjectMetricDefinitions,
  saveProjectMetricDefinitions,
} from "../workspace-store";

function metric(overrides: Partial<MetricDefinition> = {}): MetricDefinition {
  return {
    id: "monthly_revenue",
    name: "Monthly revenue",
    description: "Total revenue grouped by month.",
    formula: "SUM(revenue)",
    sourceColumns: ["revenue"],
    grain: ["month"],
    filters: [],
    exclusions: [],
    unit: "USD",
    expectedDomain: { kind: "numeric", min: 0 },
    assumptions: ["Revenue is recorded in USD."],
    limitations: ["Refunds are not subtracted."],
    source: { dataset: "orders", version: "v1" },
    status: "draft",
    updatedAt: "2026-11-22T00:00:00.000Z",
    ...overrides,
  };
}

function deleteWorkspaceDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("basira-workspace");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("workspace-database-delete-blocked"));
  });
}

describe("project metric definition persistence", () => {
  beforeEach(async () => {
    await deleteWorkspaceDatabase();
  });

  it("round-trips definitions for one project", async () => {
    const definitions = [metric()];
    expect(await saveProjectMetricDefinitions("project-a", definitions)).toBe(true);
    expect(await loadProjectMetricDefinitions("project-a")).toEqual(definitions);
  });

  it("persists the schema fingerprint with the approved definition", async () => {
    const definition = metric({
      status: "approved",
      source: { dataset: "orders", version: "v1", schemaFingerprint: "schema-v1:fnv1a64:0123456789abcdef" },
    });
    expect(await saveProjectMetricDefinitions("project-a", [definition])).toBe(true);
    expect((await loadProjectMetricDefinitions("project-a"))?.[0]?.source.schemaFingerprint)
      .toBe("schema-v1:fnv1a64:0123456789abcdef");
  });

  it("isolates registries between projects", async () => {
    await saveProjectMetricDefinitions("project-a", [metric()]);
    await saveProjectMetricDefinitions("project-b", [metric({
      id: "active_customers",
      name: "Active customers",
      formula: "COUNT(customer_id)",
      sourceColumns: ["customer_id"],
      unit: "customers",
    })]);

    expect((await loadProjectMetricDefinitions("project-a"))?.[0]?.id).toBe("monthly_revenue");
    expect((await loadProjectMetricDefinitions("project-b"))?.[0]?.id).toBe("active_customers");
    expect(await loadProjectMetricDefinitions("project-c")).toBeNull();
  });

  it("rejects duplicate IDs and names without overwriting existing data", async () => {
    const existing = [metric()];
    expect(await saveProjectMetricDefinitions("project-a", existing)).toBe(true);
    expect(await saveProjectMetricDefinitions("project-a", [
      metric(),
      metric({ id: "another_id" }),
    ])).toBe(false);
    expect(await loadProjectMetricDefinitions("project-a")).toEqual(existing);
  });

  it("clears only the selected project's registry", async () => {
    await saveProjectMetricDefinitions("project-a", [metric()]);
    await saveProjectMetricDefinitions("project-b", [metric({
      id: "active_customers",
      name: "Active customers",
    })]);

    expect(await clearProjectMetricDefinitions("project-a")).toBe(true);
    expect(await loadProjectMetricDefinitions("project-a")).toBeNull();
    expect(await loadProjectMetricDefinitions("project-b")).not.toBeNull();
  });

  it("returns false for malformed definitions", async () => {
    expect(await saveProjectMetricDefinitions(
      "project-a",
      [{ ...metric(), expectedDomain: { kind: "invalid" } } as unknown as MetricDefinition],
    )).toBe(false);
    expect(await loadProjectMetricDefinitions("project-a")).toBeNull();
  });
});
