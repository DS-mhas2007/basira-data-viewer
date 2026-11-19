/**
 * MIZYAi provider-neutral AI routing (server only).
 *
 * Secrets are read only from process.env. Never import this module from client code.
 * Routing is capability/task aware and only uses explicitly configured providers.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export type AiTask = "chat" | "sql_plan" | "report" | "discovery" | "memory";

type ProviderId = "mizyai_worker" | "gemini" | "groq" | "openrouter" | "cloudflare";

interface ProviderConfig {
  id: ProviderId;
  baseURL: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
}

export interface RoutedJsonResult {
  content: string;
  provider: ProviderId;
  model: string;
  latencyMs: number;
}

function env(name: string): string {
  return process.env[name]?.trim() ?? "";
}

/** Return configured providers in priority order; each provider's free allocation is limited. */
export function getConfiguredAiProviders(): ProviderConfig[] {
  const providers: ProviderConfig[] = [];
  const geminiKey = env("GEMINI_API_KEY");
  const groqKey = env("GROQ_API_KEY");
  const openRouterKey = env("OPENROUTER_API_KEY");
  const workerUrl = env("MIZYAI_WORKER_URL").replace(/\/$/, "");
  const workerKey = env("MIZYAI_WORKER_API_KEY");
  const cloudflareToken = env("CLOUDFLARE_API_TOKEN");
  const cloudflareAccount = env("CLOUDFLARE_ACCOUNT_ID");

  if (workerUrl && workerKey) {
    providers.push({
      id: "mizyai_worker",
      baseURL: `${workerUrl}/v1`,
      apiKey: workerKey,
      model: env("MIZYAI_WORKER_MODEL") || "@cf/google/gemma-4-26b-a4b-it",
    });
  }
  if (geminiKey) {
    providers.push({
      id: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      apiKey: geminiKey,
      model: env("GEMINI_MODEL") || "gemini-2.5-flash",
    });
  }
  if (groqKey) {
    providers.push({
      id: "groq",
      baseURL: "https://api.groq.com/openai/v1",
      apiKey: groqKey,
      model: env("GROQ_MODEL") || "openai/gpt-oss-120b",
    });
  }
  if (openRouterKey) {
    providers.push({
      id: "openrouter",
      baseURL:
        env("OPENROUTER_API_BASE").replace(/\/chat\/completions\/?$/, "") ||
        "https://openrouter.ai/api/v1",
      apiKey: openRouterKey,
      model: env("OPENROUTER_FREE_MODEL") || "openrouter/free",
      headers: {
        "HTTP-Referer": env("VITE_SITE_URL") || "https://mizyai.app",
        "X-Title": "MIZYAi",
      },
    });
  }
  if (cloudflareToken && cloudflareAccount) {
    providers.push({
      id: "cloudflare",
      baseURL: `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccount}/ai/v1`,
      apiKey: cloudflareToken,
      model: env("CLOUDFLARE_MODEL") || "@cf/google/gemma-4-26b-a4b-it",
    });
  }
  return providers;
}

type ChatModel = ReturnType<ReturnType<typeof createOpenAICompatible>>;
type StreamResult = Awaited<ReturnType<ChatModel["doStream"]>>;
type StreamPart = StreamResult["stream"] extends ReadableStream<infer P> ? P : never;

const CONTENT_PARTS = new Set([
  "text-delta",
  "tool-call",
  "tool-input-start",
  "tool-input-delta",
  "reasoning-delta",
]);

function buildModel(config: ProviderConfig, task: AiTask): { model: ChatModel; modelId: string } {
  const override = env(`${config.id.toUpperCase()}_${task.toUpperCase()}_MODEL`);
  const provider = createOpenAICompatible({
    name: `mizyai-${config.id}`,
    baseURL: config.baseURL,
    headers: { Authorization: `Bearer ${config.apiKey}`, ...config.headers },
  });
  const modelId = override || config.model;
  return { model: provider(modelId), modelId };
}

/**
 * Streams from the first provider; if it throws, errors, or finishes without any content
 * before producing output, transparently retries on the next configured provider.
 * Once content has started flowing we never switch (that would mix two answers).
 */
function withStreamFallback(candidates: { id: ProviderId; model: ChatModel }[]): ChatModel {
  const first = candidates[0]!.model;
  const wrapper = {
    specificationVersion: first.specificationVersion,
    provider: first.provider,
    modelId: first.modelId,
    supportedUrls: first.supportedUrls,
    doGenerate: first.doGenerate.bind(first),
    async doStream(options: Parameters<ChatModel["doStream"]>[0]): Promise<StreamResult> {
      let lastError: unknown;
      for (const [index, candidate] of candidates.entries()) {
        const isLast = index === candidates.length - 1;
        try {
          const result = await candidate.model.doStream(options);
          const reader = result.stream.getReader();
          const buffered: StreamPart[] = [];
          let sawContent = false;
          let failure: unknown;
          // اقرأ حتى أول محتوى فعلي، أو حتى النهاية / الخطأ
          while (!sawContent) {
            const { value, done } = await reader.read();
            if (done) break;
            buffered.push(value);
            if (CONTENT_PARTS.has(value.type)) sawContent = true;
            else if (value.type === "error") {
              failure = (value as { error?: unknown }).error ?? new Error("stream error");
              break;
            }
          }
          if (!sawContent && !isLast) {
            console.warn(
              `[MIZYAi AI] ${candidate.id} produced no content${failure ? ` (${String(failure)})` : ""}; falling back to next provider.`,
            );
            await reader.cancel().catch(() => {});
            lastError = failure;
            continue;
          }
          const stream = new ReadableStream<StreamPart>({
            start(controller) {
              for (const part of buffered) controller.enqueue(part);
            },
            async pull(controller) {
              const { value, done } = await reader.read();
              if (done) controller.close();
              else controller.enqueue(value);
            },
            cancel: (reason) => reader.cancel(reason),
          });
          return { ...result, stream } as StreamResult;
        } catch (error) {
          lastError = error;
          if (isLast) throw error;
          console.warn(`[MIZYAi AI] ${candidate.id} stream failed; falling back to next provider.`);
        }
      }
      throw lastError instanceof Error ? lastError : new Error("AI_PROVIDERS_UNAVAILABLE");
    },
  };
  return wrapper as unknown as ChatModel;
}

/** Select configured providers for AI SDK streaming, with automatic fallback when several are set. */
export function createRoutedAiModel(task: AiTask) {
  const providers = getConfiguredAiProviders();
  if (!providers.length) {
    throw new Error("AI_PROVIDER_NOT_CONFIGURED");
  }
  const built = providers.map((config) => ({ id: config.id, ...buildModel(config, task) }));
  const primary = built[0]!;
  return {
    model: built.length > 1 ? withStreamFallback(built) : primary.model,
    provider: primary.id,
    modelId: primary.modelId,
    fallbacks: built.slice(1).map((b) => b.id),
  };
}

/**
 * JSON generation with provider failover. A fallback is attempted only for transient
 * provider failures (429/5xx/network), and only among explicitly configured providers.
 */
export async function generateRoutedJson(args: {
  task: Exclude<AiTask, "chat">;
  system: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}): Promise<RoutedJsonResult> {
  const providers = getConfiguredAiProviders();
  if (!providers.length) throw new Error("AI_PROVIDER_NOT_CONFIGURED");

  let lastError: unknown;
  for (const config of providers) {
    const started = Date.now();
    const model =
      env(`${config.id.toUpperCase()}_${args.task.toUpperCase()}_MODEL`) || config.model;
    try {
      const response = await fetch(`${config.baseURL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        ...(args.signal ? { signal: args.signal } : {}),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
          ...config.headers,
        },
        body: JSON.stringify({
          model,
          temperature: args.temperature ?? 0.2,
          max_tokens: args.maxTokens ?? 2048,
          messages: [
            { role: "system", content: args.system },
            { role: "user", content: args.prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        // Do not retry authentication, invalid-request, or policy failures on another provider.
        if (response.status === 401 || response.status === 403 || response.status === 400) {
          throw new Error(`AI_PROVIDER_REJECTED:${config.id}:${response.status}`);
        }
        if (response.status !== 429 && response.status < 500) {
          throw new Error(`AI_PROVIDER_REJECTED:${config.id}:${response.status}`);
        }
        console.warn(
          `[MIZYAi AI] ${config.id} transient failure ${response.status}: ${detail.slice(0, 300)}`,
        );
        lastError = new Error(`AI_PROVIDER_TEMPORARY:${config.id}:${response.status}`);
        continue;
      }

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string | null } }[];
      };
      const content = payload.choices?.[0]?.message?.content ?? "";
      if (!content.trim()) {
        lastError = new Error(`AI_PROVIDER_EMPTY:${config.id}`);
        continue;
      }
      return { content, provider: config.id, model, latencyMs: Date.now() - started };
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("AI_PROVIDER_REJECTED:")) throw error;
      lastError = error;
      console.warn(`[MIZYAi AI] ${config.id} request failed; trying next configured provider.`);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("AI_PROVIDERS_UNAVAILABLE");
}
