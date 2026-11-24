import { describe, expect, it } from "vitest";
import { buildNarrativeFacts, validateNarrations } from "./report-narrative";

const facts = buildNarrativeFacts([
  {
    id: "a",
    title: "إجمالي الرواتب حسب القسم",
    baseRowCount: 199,
    resultRowCount: 3,
    highlights: [{ label: "الأعلى", value: "غزة" }],
    rows: [
      { القسم: "غزة", إجمالي: 9000 },
      { القسم: "نابلس", إجمالي: 7900 },
    ],
  },
]);

describe("report narratives", () => {
  it("builds facts only from the evidence rows", () => {
    expect(facts[0]!.facts.join("|")).toContain("القسم=غزة، إجمالي=9000");
  });
  it("accepts text whose numbers are all in the facts", () => {
    const r = validateNarrations([{ id: "a", text: "قسم غزة هو الأعلى بإجمالي 9000 يليه نابلس بإجمالي 7900 ضمن 199 صفاً." }], facts);
    expect(r.accepted["a"]).toBeTruthy();
  });
  it("rejects text with an invented number", () => {
    const r = validateNarrations([{ id: "a", text: "قسم غزة هو الأعلى بإجمالي 9000 وبنمو 35% عن العام الماضي." }], facts);
    expect(r.rejected).toEqual(["a"]);
  });
  it("rejects unknown ids and non-Arabic text", () => {
    const r = validateNarrations([{ id: "zzz", text: "نص عربي طويل بما يكفي للقبول هنا." }, { id: "a", text: "English only text that is long enough." }], facts);
    expect(r.rejected.sort()).toEqual(["a", "zzz"]);
  });
});
