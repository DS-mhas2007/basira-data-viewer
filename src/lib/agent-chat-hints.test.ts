import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./agent-chat";

describe("buildSystemPrompt column hints", () => {
  it("includes a column hint on one line and omits it when absent", () => {
    const prompt = buildSystemPrompt({
      table: "dataset",
      rowCount: 10,
      fileName: "f.csv",
      schema: [
        { name: "OrderDate", type: "VARCHAR", hint: "نص بصيغة '%m/%d/%Y'\nسطر ثانٍ" },
        { name: "Sales", type: "DOUBLE" },
      ],
    });
    expect(prompt).toContain(`"OrderDate" (VARCHAR) — نص بصيغة '%m/%d/%Y' سطر ثانٍ`);
    expect(prompt).toContain(`"Sales" (DOUBLE)\n`);
  });
});

describe("buildSystemPrompt data state", () => {
  const base = { table: "dataset", rowCount: 5, fileName: "f.csv", schema: [{ name: "A", type: "DOUBLE" }] };

  it("states raw data when no cleaning steps were applied", () => {
    expect(buildSystemPrompt(base)).toContain("لم تُطبَّق أي خطوة تنظيف");
  });

  it("lists applied cleaning steps", () => {
    const p = buildSystemPrompt({ ...base, cleaningSteps: ["إزالة 3 صف مكرر", "ملء القيم المفقودة"] });
    expect(p).toContain("طُبّقت 2 خطوة تنظيف");
    expect(p).toContain("النسخة المنظَّفة");
  });
});
