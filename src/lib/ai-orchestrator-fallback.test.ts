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
    vi.stubEnv("AI_PROVIDER_ORDER", "mizyai_worker,gemini");
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(String(url));
        if (String(url).startsWith("https://worker.test")) {
          return sse([chunk({ role: "assistant" }), chunk({}, "stop"), "data: [DONE]\n\n"]);
        }
        return sse([
          chunk({ role: "assistant" }),
          chunk({ content: "مرحبا" }),
          chunk({}, "stop"),
          "data: [DONE]\n\n",
        ]);
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
    vi.stubEnv("AI_PROVIDER_ORDER", "mizyai_worker,gemini");
    const fetchMock = vi.fn(async () =>
      sse([
        chunk({ role: "assistant" }),
        chunk({ content: "أول" }),
        chunk({}, "stop"),
        "data: [DONE]\n\n",
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { stream } = await createRoutedAiModel("chat").model.doStream(opts);
    const parts = await collect(stream as never);
    expect(parts.some((p) => p.delta === "أول")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

import {
  generateRoutedJson,
  getConfiguredAiProviders,
  resetProviderCooldowns,
} from "./ai-orchestrator.server";

describe("provider routing", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetProviderCooldowns();
  });

  function allProviders() {
    vi.stubEnv("MIZYAI_WORKER_URL", "https://worker.test");
    vi.stubEnv("MIZYAI_WORKER_API_KEY", "w");
    vi.stubEnv("GEMINI_API_KEY", "g");
    vi.stubEnv("GROQ_API_KEY", "q");
  }

  it("puts Groq first for chat/sql and the Cloudflare worker first for cheap tasks", () => {
    allProviders();
    expect(getConfiguredAiProviders("chat").map((p) => p.id)).toEqual([
      "groq",
      "gemini",
      "mizyai_worker",
    ]);
    expect(getConfiguredAiProviders("sql_plan")[0]!.id).toBe("groq");
    expect(getConfiguredAiProviders("memory")[0]!.id).toBe("mizyai_worker");
  });

  it("honours AI_PROVIDER_ORDER", () => {
    allProviders();
    vi.stubEnv("AI_PROVIDER_ORDER", "gemini,mizyai_worker");
    expect(getConfiguredAiProviders("chat").map((p) => p.id)).toEqual([
      "gemini",
      "mizyai_worker",
      "groq",
    ]);
  });

  it("falls back from Groq 429 to the next provider, then skips Groq while it cools down", async () => {
    allProviders();
    const hosts: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        hosts.push(new URL(String(url)).host);
        if (String(url).includes("groq.com")) {
          return new Response("rate limited", { status: 429, headers: { "retry-after": "30" } });
        }
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }),
          {
            status: 200,
          },
        );
      }),
    );
    const args = { task: "sql_plan" as const, system: "s", prompt: "p" };
    const first = await generateRoutedJson(args);
    expect(first.provider).toBe("gemini");
    expect(hosts[0]).toContain("groq.com");
    hosts.length = 0;
    const second = await generateRoutedJson(args);
    expect(second.provider).toBe("gemini");
    expect(hosts.some((h) => h.includes("groq.com"))).toBe(false);
  });

  it("falls back even when a provider key is rejected (401)", async () => {
    allProviders();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        String(url).includes("groq.com")
          ? new Response("bad key", { status: 401 })
          : new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), {
              status: 200,
            }),
      ),
    );
    const r = await generateRoutedJson({
      task: "chat" as never,
      system: "s",
      prompt: "p",
    } as never);
    expect(r.provider).toBe("gemini");
  });

  it("skips a saturated provider instead of queueing behind it", async () => {
    allProviders();
    vi.stubEnv("GROQ_MAX_CONCURRENCY", "1");
    let releaseGroq!: () => void;
    const groqBlocked = new Promise<void>((resolve) => {
      releaseGroq = resolve;
    });
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("groq.com")) {
        await groqBlocked;
        return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({ choices: [{ message: { content: '{"fallback":true}' } }] }),
        {
          status: 200,
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const args = { task: "sql_plan" as const, system: "s", prompt: "p" };
    const first = generateRoutedJson(args);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const second = await generateRoutedJson(args);
    expect(second.provider).toBe("gemini");
    releaseGroq();
    expect((await first).provider).toBe("groq");
  });
});
