import { describe, expect, it } from "vitest";
import { getToolResultFallback, inspectAssistantTurn } from "./agent-chat-response";

describe("assistant turn response recovery", () => {
  it("uses a successful tool result when the model sends no final text", () => {
    const messages = [
      { role: "user", parts: [{ type: "text", text: "عن ماذا تعبر البيانات؟" }] },
      {
        role: "assistant",
        parts: [{
          type: "tool-quick_analysis",
          state: "output-available",
          output: { ok: true, message_ar: "تُظهر البيانات نمواً في المبيعات." },
        }],
      },
    ];

    expect(inspectAssistantTurn(messages)).toEqual({
      kind: "tool-result",
      message: "تُظهر البيانات نمواً في المبيعات.",
      ok: true,
    });
    expect(getToolResultFallback(messages[1]!.parts)).toBe("تُظهر البيانات نمواً في المبيعات.");
  });

  it("preserves a failed tool message instead of reporting a blank response", () => {
    const messages = [{
      role: "assistant",
      parts: [{
        type: "tool-quick_analysis",
        state: "output-available",
        output: { ok: false, message_ar: "تعذّر تنفيذ الاستعلام بأمان." },
      }],
    }];

    expect(inspectAssistantTurn(messages)).toMatchObject({
      kind: "tool-result",
      message: "تعذّر تنفيذ الاستعلام بأمان.",
      ok: false,
    });
  });

  it("prefers a real assistant final answer when present", () => {
    const messages = [{
      role: "assistant",
      parts: [
        { type: "tool-quick_analysis", state: "output-available", output: { ok: true, message_ar: "نتيجة الأداة" } },
        { type: "text", text: "الخلاصة النهائية." },
      ],
    }];

    expect(inspectAssistantTurn(messages)).toEqual({ kind: "text" });
  });

  it("reports empty only when there is neither text nor a completed tool result", () => {
    expect(inspectAssistantTurn([
      { role: "user", parts: [{ type: "text", text: "حلّل البيانات" }] },
      { role: "assistant", parts: [] },
    ])).toEqual({ kind: "empty" });
  });

  it("waits for tool continuation while a tool call has no result yet", () => {
    expect(inspectAssistantTurn([
      { role: "user", parts: [{ type: "text", text: "عن ماذا تعبر البيانات؟" }] },
      { role: "assistant", parts: [{ type: "tool-quick_analysis", state: "input-available" }] },
    ])).toEqual({ kind: "pending-tool" });
  });
});
