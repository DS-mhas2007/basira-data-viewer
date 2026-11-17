# MIZYAi Cloudflare AI Orchestrator

This Worker is the server-side, OpenAI-compatible gateway used by the MIZYAi application.

## Runtime

- Worker name: `mizyai-ai-orchestrator`
- Endpoint: `POST /v1/chat/completions`
- Health check: `GET /health`
- Workers AI binding: `AI`
- Secret binding: `MIZYAI_API_KEY`
- Default model: `@cf/google/gemma-4-26b-a4b-it`

The Worker converts OpenAI-compatible tool schemas to the Workers AI function-calling format and converts returned tool calls back to OpenAI-compatible messages. This is required by the chat agent, which runs SQL and other tools locally in the browser.

## Deploy

Install Wrangler, then from this directory:

```bash
npx wrangler secret put MIZYAI_API_KEY
npx wrangler deploy
```

The secret value must match the application's server-side `MIZYAI_WORKER_API_KEY`. Never commit either value. Configure the AI binding through `wrangler.toml`.

## Tests

From the repository root:

```bash
bunx vitest run workers/mizyai-ai-orchestrator/worker.test.js
```

## Cost boundary

Workers AI currently includes a daily free allocation. Requests can fail after the allocation is exhausted on the Free plan; do not upgrade to a paid Workers plan without checking the current pricing and obtaining approval. The Worker itself does not log prompts or tool results.
