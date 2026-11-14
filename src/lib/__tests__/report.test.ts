import { describe, expect, it } from "vitest";
import { reportFileName } from "@/lib/report";

describe("reportFileName", () => {
  it("uses the MIZYA report prefix and a stable local date", () => {
    expect(reportFileName("sales.csv", new Date(2026, 10, 14))).toBe(
      "تقرير-MIZYA-sales-2026-11-14.pdf",
    );
  });

  it("sanitizes unsafe filename characters and falls back for an empty name", () => {
    expect(reportFileName("sales/final?.csv", new Date(2026, 10, 14))).toBe(
      "تقرير-MIZYA-sales_final_-2026-11-14.pdf",
    );
    expect(reportFileName(".csv", new Date(2026, 10, 14))).toBe(
      "تقرير-MIZYA-بيانات-2026-11-14.pdf",
    );
  });
});
