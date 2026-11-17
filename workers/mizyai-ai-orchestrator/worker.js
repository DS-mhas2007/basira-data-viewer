const DEFAULT_MODEL = "@cf/google/gemma-4-26b-a4b-it";
const ALLOWED_MODELS = new Set([
  "@cf/google/gemma-4-26b-a4b-it",
  "@cf/zai-org/glm-4.7-flash",
]);
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 12000;
const MAX_PROMPT_CHARS = 24000;
const MAX_TOOLS = 12;

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-max-age": "86400",
  vary: "Origin",
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders, ...extra },
  });
}

function unauthorized() {
  return json(
    { error: { message: "Unauthorized", type: "authentication_error" } },
    401,
    { "www-authenticate": "Bearer" },
  );
}

function safeEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function contentText(value) {
  if (typeof value === "string") return value.slice(0, MAX_MESSAGE_CHARS);
  if (value == null) return "";
  return JSON.stringify(value).slice(0, MAX_MESSAGE_CHARS);
}

export function normalizeMessages(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(-MAX_MESSAGES).map((message) => {
    const role = ["system", "user", "assistant", "tool"].includes(message?.role)
      ? message.role
      : "user";
    const normalized = { role, content: contentText(message?.content) };

    if (role === "assistant" && Array.isArray(message.tool_calls)) {
      normalized.tool_calls = message.tool_calls.slice(0, MAX_TOOLS).map((call) => ({
        id: String(call?.id ?? "").slice(0, 128),
        type: "function",
        function: {
          name: String(call?.function?.name ?? "").slice(0, 100),
          arguments: String(call?.function?.arguments ?? "{}").slice(0, 8000),
        },
      }));
    }

    if (role === "tool") {
      normalized.tool_call_id = String(message?.tool_call_id ?? "").slice(0, 128);
      if (message?.name) normalized.name = String(message.name).slice(0, 100);
    }

    return normalized;
  });
}

export function normalizeTools(openAiTools, requestedChoice) {
  const definitions = Array.isArray(openAiTools)
    ? openAiTools
        .filter((item) => item?.type === "function" && item.function?.name)
        .slice(0, MAX_TOOLS)
        .map((item) => ({
          name: String(item.function.name).slice(0, 100),
          description: String(item.function.description ?? "").slice(0, 1000),
          parameters:
            item.function.parameters && typeof item.function.parameters === "object"
              ? item.function.parameters
              : { type: "object", properties: {} },
        }))
    : [];

  const forcedName =
    requestedChoice && typeof requestedChoice === "object"
      ? requestedChoice.function?.name
      : null;

  const tools = forcedName
    ? definitions.filter((item) => item.name === forcedName)
    : definitions;

  const choice =
    forcedName
      ? "required"
      : typeof requestedChoice === "string"
        ? requestedChoice
        : "auto";

  if (choice === "none" || tools.length === 0) {
    return { tools: [], toolChoice: undefined };
  }

  return { tools, toolChoice: choice };
}

export function normalizeToolCalls(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((call) => call?.name || call?.function?.name)
    .slice(0, MAX_TOOLS)
    .map((call) => {
      const rawArguments = call.arguments ?? call.function?.arguments ?? {};
      const args =
        typeof rawArguments === "string"
          ? rawArguments
          : JSON.stringify(rawArguments ?? {});
      return {
        id: String(call.id ?? "call_" + crypto.randomUUID()).slice(0, 128),
        type: "function",
        function: {
          name: String(call.name ?? call.function?.name).slice(0, 100),
          arguments: args,
        },
      };
    });
}

function makeChunk(id, model, delta, finishReason = null) {
  return (
    "data: " +
    JSON.stringify({
      id,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    }) +
    "\n\n"
  );
}

function completionResponse(result, id, model, streaming) {
  const content = typeof result?.response === "string" ? result.response : "";
  const toolCalls = normalizeToolCalls(result?.tool_calls);
  const message = {
    role: "assistant",
    content: content || null,
    ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
  };
  const finishReason = toolCalls.length ? "tool_calls" : "stop";

  if (!streaming) {
    return json({
      id,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, message, finish_reason: finishReason }],
    });
  }

  const events = [makeChunk(id, model, { role: "assistant" })];
  if (content) events.push(makeChunk(id, model, { content }));
  if (toolCalls.length) {
    events.push(makeChunk(id, model, { tool_calls: toolCalls.map((call, index) => ({ ...call, index })) }));
  }
  events.push(makeChunk(id, model, {}, finishReason));
  events.push("data: [DONE]\n\n");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(event));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders,
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        ok: true,
        service: "MIZYAi AI Orchestrator",
        version: "0.3.0",
        model: DEFAULT_MODEL,
        functionCalling: true,
      });
    }

    if (url.pathname !== "/v1/chat/completions" || request.method !== "POST") {
      return json({ error: { message: "Not found", type: "not_found" } }, 404);
    }

    if (!env.MIZYAI_API_KEY || !env.AI) {
      return json(
        { error: { message: "AI service is not configured", type: "configuration_error" } },
        503,
      );
    }

    const auth = request.headers.get("authorization") || "";
    const supplied = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!safeEqual(supplied, env.MIZYAI_API_KEY)) return unauthorized();

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: { message: "Request body must be valid JSON", type: "invalid_request_error" } }, 400);
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return json({ error: { message: "messages must be a non-empty array", type: "invalid_request_error" } }, 400);
    }

    const messages = normalizeMessages(body.messages);
    const promptLength = messages.reduce((total, item) => total + item.content.length, 0);
    if (promptLength > MAX_PROMPT_CHARS) {
      return json(
        { error: { message: "Input is too long (24,000 characters max)", type: "invalid_request_error" } },
        413,
      );
    }

    const model = ALLOWED_MODELS.has(body.model) ? body.model : DEFAULT_MODEL;
    const mapped = normalizeTools(body.tools, body.tool_choice);
    const id = "mizyai-" + crypto.randomUUID();
    const options = {
      messages,
      max_tokens: Math.min(Math.max(Number(body.max_tokens ?? body.max_completion_tokens) || 1200, 1), 2048),
      temperature:
        typeof body.temperature === "number"
          ? Math.min(Math.max(body.temperature, 0), 1.5)
          : 0.2,
    };

    if (mapped.tools.length) {
      options.tools = mapped.tools;
      if (mapped.toolChoice) options.tool_choice = mapped.toolChoice;
    }
    if (body.response_format && typeof body.response_format === "object") {
      options.response_format = body.response_format;
    }

    try {
      // We collect the structured tool-call result first, then expose it as OpenAI-compatible SSE.
      const result = await env.AI.run(model, options);
      return completionResponse(result, id, model, body.stream === true);
    } catch {
      return json(
        { error: { message: "AI inference failed", type: "upstream_error" } },
        502,
      );
    }
  },
};
