# MIZYAi — Hybrid AI Provider Setup

## Purpose

The application uses `src/lib/ai-orchestrator.server.ts` as the server-only provider boundary. UI components and browser code must never read provider credentials or call provider endpoints directly.

## Configure one or more providers

Add secrets in the deployment environment (Lovable project secrets / server environment). Do not commit real values.

| Provider | Required secrets | Default model |
|---|---|---|
| Gemini | `GEMINI_API_KEY` | `gemini-2.5-flash` |
| Groq | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |
| OpenRouter | `OPENROUTER_API_KEY` | `google/gemma-4-31b-it:free` |
| Cloudflare Workers AI | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |

Optional model overrides are supported, for example `GEMINI_CHAT_MODEL`, `GROQ_SQL_PLAN_MODEL`, and `OPENROUTER_REPORT_MODEL`. The provider-specific model override must match a model available to that account.

## Routing behavior

- Provider preference: Gemini → Groq → OpenRouter → Cloudflare.
- SQL planning and report generation retry the next configured provider for network failures, HTTP 429, and HTTP 5xx.
- HTTP 400, 401, and 403 are treated as request/configuration failures and stop fallback to avoid hiding invalid credentials or incompatible requests.
- Chat uses the first configured provider for streaming. It does not switch providers after stream output has started.
- Structured SQL plans and report payloads are validated with Zod after generation.
- Existing local DuckDB calculations remain deterministic; the model explains or plans work but does not replace SQL execution or evidence validation.

## Privacy and data minimization

- Original CSV/XLSX files remain in the browser-based DuckDB workflow described in the data-flow audit.
- SQL planning sends the question, table name, schema, and up to 10 sample rows.
- Report generation sends a bounded JSON summary of local analysis results.
- Chat sends the conversation and tool results required for the model response.
- Provider retention and training policies differ. Review the current terms of the selected provider and do not send regulated or sensitive data unless the user has an appropriate legal basis and explicit product controls.

## Free-tier expectations

This configuration is designed to start with providers that offer free quotas, but free access is not guaranteed, unlimited, or permanent. Quotas, model availability, and eligibility can change. Keep the model names configurable and monitor provider usage. A free key is still a secret and must remain server-side.

## Current scope

This first integration routes:
- conversational chat (streaming),
- natural-language SQL planning,
- executive report generation.

The local Discovery/Findings engine remains deterministic and runs in DuckDB. Cross-project semantic memory/embeddings and AI-generated discovery are separate follow-up work; existing chat thread persistence remains the current conversation history mechanism.
