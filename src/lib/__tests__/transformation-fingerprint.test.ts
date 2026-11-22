import { describe, expect, it } from "vitest";
import { compareTransformationFingerprint, computeTransformationFingerprint } from "../transformation-fingerprint";
import type { CleanStep } from "../cleaning";

const source = `content-v1:sha256:${"a".repeat(64)}`;
const trimStep = (overrides: Partial<CleanStep> = {}): CleanStep => ({
  id: "step-1",
  kind: "trim",
  label: "Trim text",
  affectedRows: 12,
  params: { allColumns: ["name", "city"], textColumns: ["name", "city"] },
  ...overrides,
});

describe("transformation recipe fingerprint", () => {
  it("is deterministic and ignores UI-only step metadata", async () => {
    const first = await computeTransformationFingerprint(source, [trimStep()]);
    const second = await computeTransformationFingerprint(source, [
      trimStep({ id: "different-id", label: "Different label", affectedRows: 99 }),
    ]);
    expect(first).toBe(second);
    expect(first).toMatch(/^transform-v1:sha256:[0-9a-f]{64}$/);
  });

  it("changes when operation order or parameters change", async () => {
    const trim = trimStep();
    const fill = trimStep({
      id: "step-2",
      kind: "fill",
      params: { allColumns: ["name", "city"], column: "name", fillValue: "Unknown" },
    });
    const ordered = await computeTransformationFingerprint(source, [trim, fill]);
    const reversed = await computeTransformationFingerprint(source, [fill, trim]);
    const changed = await computeTransformationFingerprint(source, [
      trim,
      { ...fill, params: { ...fill.params, fillValue: "N/A" } },
    ]);
    expect(reversed).not.toBe(ordered);
    expect(changed).not.toBe(ordered);
  });

  it("binds the recipe to the source content identity", async () => {
    const otherSource = `content-v1:sha256:${"b".repeat(64)}`;
    expect(await computeTransformationFingerprint(source, [trimStep()]))
      .not.toBe(await computeTransformationFingerprint(otherSource, [trimStep()]));
  });

  it("rejects missing or malformed source fingerprints", async () => {
    await expect(computeTransformationFingerprint("invalid", [])).rejects.toThrow();
  });

  it("compares aligned, changed, and incomplete evidence conservatively", () => {
    const fingerprint = `transform-v1:sha256:${"a".repeat(64)}`;
    const changed = `transform-v1:sha256:${"b".repeat(64)}`;
    expect(compareTransformationFingerprint(fingerprint, fingerprint).status).toBe("aligned");
    expect(compareTransformationFingerprint(fingerprint, changed).status).toBe("mismatch");
    expect(compareTransformationFingerprint(undefined, fingerprint).status).toBe("insufficient-evidence");
  });
});
