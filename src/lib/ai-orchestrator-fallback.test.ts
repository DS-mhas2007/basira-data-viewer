import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoutedAiModel } from "./ai-orchestrator.server";

function sse(chunks: string[]) {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        for (const x of chunks) c.enqueue(enc.encode(x));
        c.close();
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  );
}
const chunk = (delta: object, finish: string | null = null) =>
  `data: ${JSON.stringify({ id: "1", object: "chat.completion.chunk", created: 1, model: "m", choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`;

const opts = { prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }] } as never;

async function collect(stream: ReadableStream<{ type: string; delta?: string }>) {
  const out: { type: string; delta?: string }[] = [];
  const r = stream.getReader();
  for (;;) {
    const { value, done } = await r.read();
    if (done) break;
    out.push(value);
  }
  return out;
}

describe("chat provider fallback", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("falls back when the first provider streams no content", async () => {
    vi.stubEnv("MIZYAI_WORKER_URL", "https://worker.test");
    vi.stubEnv("MIZYAI_WORKER_API_KEY", "k1");
    vi.stubEnv("GEMINI_API_KEY", "k2");
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(String(url));
        if (String(url).startsWith("https://worker.test")) {
          return sse([chunk({ role: "assistant" }), chunk({}, "stop"), "data: [DONE]\n\n"]);
        }
        return sse([chunk({ role: "assistant" }), chunk({ content: "مرحبا" }), chunk({}, "stop"), "data: [DONE]\n\n"]);
      }),
    );
    const routed = createRoutedAiModel("chat");
    expect(routed.provider).toBe("mizyai_worker");
    const { stream } = await routed.model.doStream(opts);
    const parts = await collect(stream as never);
    expect(parts.some((p) => p.type === "text-delta" && p.delta === "مرحبا")).toBe(true);
    expect(calls.length).toBe(2);
  });

  it("does not fall back when the first provider answers", async () => {
    vi.stubEnv("MIZYAI_WORKER_URL", "https://worker.test");
    vi.stubEnv("MIZYAI_WORKER_API_KEY", "k1");
    vi.stubEnv("GEMINI_API_KEY", "k2");
    const fetchMock = vi.fn(async () =>
      sse([chunk({ role: "assistant" }), chunk({ content: "أول" }), chunk({}, "stop"), "data: [DONE]\n\n"]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { stream } = await createRoutedAiModel("chat").model.doStream(opts);
    const parts = await collect(stream as never);
    expect(parts.some((p) => p.delta === "أول")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
