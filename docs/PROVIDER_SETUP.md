# Provider Setup

`LLM_PROVIDER` supports `replay`, `openai`, and `openclaw`. The browser posts only user text and the current Scene Graph to `/api/plan`; API credentials never enter browser JavaScript.

## Replay

Default and credential-free:

```env
LLM_PROVIDER=replay
```

It covers the required flower-garden creation, targeted follow-up, save, load, undo and clear intents.

## OpenAI-compatible

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

`OPENAI_BASE_URL` can point to another compatible service. Responses must be JSON objects matching the documented plan contract.

## OpenClaw

```env
LLM_PROVIDER=openclaw
OPENCLAW_URL=http://127.0.0.1:18789
OPENCLAW_TOKEN=...
OPENCLAW_MODEL=openclaw/main
```

Provider timeout, invalid JSON and HTTP failures automatically return a deterministic replay plan with `source: replay-fallback`.
