import { describe, expect, it } from "vitest";
import {
  extractResult,
  normalizeMessages,
  normalizeToolCalls,
  normalizeTools,
} from "./worker.js";

describe("MIZYAi Worker OpenAI protocol adapter", () => {
  it("preserves assistant tool calls and tool results across turns", () => {
    const messages = normalizeMessages([
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "run_sql", arguments: "{\"sql\":\"SELECT 1\"}" },
          },
        ],
      },
      { role: "tool", tool_call_id: "call_1", name: "run_sql", content: "{\"rows\":[{\"n\":1}]}" },
    ]);

    expect(messages[0]?.tool_calls?.[0]?.function.name).toBe("run_sql");
    expect(messages[1]).toMatchObject({ role: "tool", tool_call_id: "call_1", name: "run_sql" });
  });

  it("converts OpenAI tool definitions into Workers AI definitions", () => {
    const result = normalizeTools(
      [
        {
          type: "function",
          function: {
            name: "run_sql",
            description: "Run local SQL",
            parameters: { type: "object", properties: { sql: { type: "string" } } },
          },
        },
      ],
      "auto",
    );

    expect(result).toEqual({
      tools: [
        {
          name: "run_sql",
          description: "Run local SQL",
          parameters: { type: "object", properties: { sql: { type: "string" } } },
        },
      ],
      toolChoice: "auto",
    });
  });

  it("restricts a forced function choice to that function", () => {
    const result = normalizeTools(
      [
        { type: "function", function: { name: "run_sql", parameters: { type: "object" } } },
        { type: "function", function: { name: "add_chart", parameters: { type: "object" } } },
      ],
      { type: "function", function: { name: "run_sql" } },
    );

    expect(result.tools.map((tool) => tool.name)).toEqual(["run_sql"]);
    expect(result.toolChoice).toBe("required");
  });

  it("normalizes Workers AI tool calls to OpenAI completion calls", () => {
    const calls = normalizeToolCalls([{ name: "run_sql", arguments: { sql: "SELECT 1" } }]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.type).toBe("function");
    expect(calls[0]?.function.name).toBe("run_sql");
    expect(JSON.parse(calls[0]?.function.arguments ?? "{}")).toEqual({ sql: "SELECT 1" });
  });

  it("reads both legacy and OpenAI-style Workers AI results", () => {
    expect(extractResult({ response: "مرحبا" }).content).toBe("مرحبا");
    expect(extractResult({ choices: [{ message: { content: "hi" } }] }).content).toBe("hi");
    expect(extractResult({ choices: [{ message: { content: [{ text: "a" }, { text: "b" }] } }] }).content).toBe("ab");
    const viaChoices = extractResult({
      choices: [{ message: { content: null, tool_calls: [{ id: "c1", function: { name: "run_sql", arguments: "{}" } }] } }],
    });
    expect(viaChoices.toolCalls[0]?.function.name).toBe("run_sql");
    expect(extractResult({}).content).toBe("");
  });
});
