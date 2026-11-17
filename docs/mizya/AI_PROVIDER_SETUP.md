# MIZYAi — Hybrid AI Provider Setup

## Purpose

The application uses `src/lib/ai-orchestrator.server.ts` as the server-only provider boundary. UI components and browser code must never read provider credentials or call provider endpoints directly.

## Configure one or more providers

Add secrets in the hosting environment's server-side secrets/settings (for example, Lovable project secrets). Never put provider credentials in client-side variables or commit real values.

### Dedicated MIZYAi Worker (recommended)

Set these values in the **application hosting environment**:

- `MIZYAI_WORKER_URL` = `https://mizyai-ai-orchestrator.mhasplaygame.workers.dev`
- `MIZYAI_WORKER_API_KEY` = the newly rotated secret value (the same value configured as `MIZYAI_API_KEY` in the Cloudflare Worker)
- `MIZYAI_WORKER_MODEL` = `@cf/google/gemma-4-26b-a4b-it` (optional; this is the default)

In the **Cloudflare Worker** itself, the secret binding name is `MIZYAI_API_KEY`. These two variable names are intentionally different: the Worker validates the incoming bearer token, while the application uses `MIZYAI_WORKER_API_KEY` to send it.

After changing server-side secrets, trigger a new deployment/restart so the server functions receive the updated environment. Do not share the secret in chat, source code, browser variables, or GitHub.

| Provider | Required server-side environment variables | Default model |
|---|---|---|
| Dedicated MIZYAi Cloudflare Worker | `MIZYAI_WORKER_URL`, `MIZYAI_WORKER_API_KEY` | `@cf/google/gemma-4-26b-a4b-it` |
| Gemini | `GEMINI_API_KEY` | `gemini-2.5-flash` |
| Groq | `GROQ_API_KEY` | `openai/gpt-oss-120b` |
| OpenRouter | `OPENROUTER_API_KEY` | `openrouter/free` |
| Direct Cloudflare Workers AI API | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `@cf/google/gemma-4-26b-a4b-it` |

Optional model overrides are supported, for example `GEMINI_CHAT_MODEL`, `GROQ_SQL_PLAN_MODEL`, and `OPENROUTER_REPORT_MODEL`. The provider-specific model override must match a model available to that account.

## Routing behavior

- Provider preference: dedicated MIZYAi Cloudflare Worker → Gemini → Groq → OpenRouter → direct Cloudflare Workers AI API.
- The dedicated Worker exposes an OpenAI-compatible `/v1/chat/completions` endpoint, authenticates with a server-side bearer secret, and maps OpenAI tool definitions to Workers AI function calling. Its default model is `@cf/google/gemma-4-26b-a4b-it`, which supports function calling. It is the preferred no-card route while the account's Workers AI free allocation remains available.
- SQL planning and report generation retry the next configured provider for network failures, HTTP 429, and HTTP 5xx.
- HTTP 400, 401, and 403 are treated as request/configuration failures and stop fallback to avoid hiding invalid credentials or incompatible requests.
- Chat uses the first configured provider for streaming. It does not switch providers after stream output has started.
- Structured SQL plans and report payloads are validated with Zod after generation.
- Existing local DuckDB calculations remain deterministic; the model explains or plans work but does not replace SQL execution or evidence validation.

## Privacy and data minimization

- Original CSV/XLSX files remain in the browser-based DuckDB workflow described in the data-flow audit.
- SQL planning sends the question, table name, schema, and up to 8 sample rows from the current UI (the server accepts at most 10).
- Report generation sends a bounded JSON summary of local analysis results.
- Chat sends the conversation and the tool results required for the model response; each local SQL tool result returns a preview of at most 30 rows. The “do not save” toggle disables Supabase message persistence only; it does not prevent provider transmission.
- Provider retention and training policies differ. Review the current terms of the selected provider and do not send regulated or sensitive data unless the user has an appropriate legal basis and explicit product controls.

## Free-tier expectations

Cloudflare Workers AI currently includes 10,000 Neurons per day at no charge. On Workers Free, requests stop when the free allocation is exhausted; usage beyond it requires the Workers Paid plan. Other providers have separate, changeable free quotas. Free access is not unlimited or permanent. Quotas, model availability, and eligibility can change. Keep the model names configurable and monitor provider usage. A free key is still a secret and must remain server-side.

## Current scope

This first integration routes:
- conversational chat (streaming),
- natural-language SQL planning,
- executive report generation.

The local Discovery/Findings engine remains deterministic and runs in DuckDB. Cross-project semantic memory/embeddings and AI-generated discovery are separate follow-up work; existing chat thread persistence remains the current conversation history mechanism.
