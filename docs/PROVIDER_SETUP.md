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

`OPENAI_BASE_URL` can point to another compatible service (DeepSeek, etc.). Responses must be JSON objects matching the documented plan contract.

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=...
OPENAI_BASE_URL=https://api.deepseek.com/v1
OPENAI_MODEL=deepseek-chat
```

## OpenClaw

```env
LLM_PROVIDER=openclaw
OPENCLAW_URL=http://127.0.0.1:18789
OPENCLAW_TOKEN=...
OPENCLAW_MODEL=openclaw/main
```

Provider timeout, invalid JSON and HTTP failures automatically return a deterministic replay plan with `source: replay-fallback`.

## STT

`STT_PROVIDER=browser` keeps recognition entirely in the browser. `STT_PROVIDER=openai` records while the user holds the mic/Quest trigger, uploads only that audio to the project server, and lets the server call the configured Whisper-compatible endpoint. The API key remains server-side.

## TTS and lip sync

- `TTS_PROVIDER=browser`: browser speech synthesis plus bounded synthetic viseme fallback;
- `TTS_PROVIDER=openai`: server-side speech generation; audio-time viseme fallback when timestamps are unavailable;
- `TTS_PROVIDER=elevenlabs`: server-side speech with alignment timestamps passed to `vrm-actor`;
- `TTS_PROVIDER=minimax`: MiniMax T2A v2 (`speech-2.8-hd` by default). Set `MINIMAX_API_KEY` and `MINIMAX_VOICE_ID` (cloned voices such as `MaiClone` work). Audio-time viseme fallback.

If a TTS request fails, the UI falls back to browser speech without blocking scene execution.
