import { describe, expect, it } from "vitest";
import { formatLineageDependencies } from "./lineage-display";

describe("formatLineageDependencies", () => {
  it("prefers relation-qualified references when available", () => {
    expect(formatLineageDependencies(
      ["customer_id", "order_total"],
      [
        { table: "orders", column: "customer_id" },
        { table: "customers", column: "customer_id" },
      ],
    )).toEqual(["orders.customer_id", "customers.customer_id"]);
  });

  it("falls back to legacy column names when references are absent", () => {
    expect(formatLineageDependencies(["revenue", "quantity"])).toEqual(["revenue", "quantity"]);
  });

  it("falls back when relation references contain no usable identifiers", () => {
    expect(formatLineageDependencies(["revenue"], [{ table: " ", column: "" }])).toEqual(["revenue"]);
  });

  it("removes empty and duplicate dependencies", () => {
    expect(formatLineageDependencies(["revenue", "", "revenue", " quantity "])).toEqual(["revenue", "quantity"]);
  });

  it("returns an empty list for missing or empty lineage fields", () => {
    expect(formatLineageDependencies()).toEqual([]);
    expect(formatLineageDependencies([], [])).toEqual([]);
  });
});
