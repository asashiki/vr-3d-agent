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

Quest Browser 不提供 Chrome 桌面端的 `SpeechRecognition` API，因此 Quest 语音必须使用 `MediaRecorder → /api/stt → Whisper-compatible endpoint`。推荐：

```env
STT_PROVIDER=auto
STT_API_KEY=...
STT_BASE_URL=https://api.openai.com/v1
STT_MODEL=whisper-1
```

`STT_API_KEY` 未设置时会备用 `OPENAI_API_KEY`；`STT_BASE_URL` 未设置时会备用 `OPENAI_BASE_URL`。旧配置中的 `STT_PROVIDER=browser` 在存在服务端密钥时也会自动保留 Quest 服务端后备，不再直接报“浏览器没有语音识别”。仅上传用户按住 A/X 期间的录音，密钥始终留在服务端。如需完全关闭，使用 `STT_PROVIDER=disabled`。

## TTS and lip sync

- `TTS_PROVIDER=browser`: browser speech synthesis plus bounded synthetic viseme fallback;
- `TTS_PROVIDER=openai`: server-side speech generation; audio-time viseme fallback when timestamps are unavailable;
- `TTS_PROVIDER=elevenlabs`: server-side speech with alignment timestamps passed to `vrm-actor`;
- `TTS_PROVIDER=minimax`: MiniMax T2A v2 (`speech-2.8-hd` by default). Set `MINIMAX_API_KEY` and `MINIMAX_VOICE_ID` (cloned voices such as `MaiClone` work). Audio-time viseme fallback.

If a TTS request fails, the UI falls back to browser speech without blocking scene execution.
