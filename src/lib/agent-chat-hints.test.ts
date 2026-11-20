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
