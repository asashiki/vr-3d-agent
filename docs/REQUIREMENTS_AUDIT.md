# Prompt / Plan Requirements Audit

Audit basis:

- `VR3D_AGENT_WORK_PROMPT.md` (241 lines)
- `VR3D_AGENT_MVP_PLAN.md` (928 lines)

Last audited: 2026-08-31. “Implemented” means code and an automated check exist where automation is possible. It does not mean Quest hardware was tested.

| Milestone | Requirement | Evidence | Status |
| --- | --- | --- | --- |
| M0 | Incarna fork, attribution, baseline, offline fixture | `LICENSE`, `CREDITS.md`, `docs/BASELINE.md`, `fixtures/garden-replay.json` | Implemented |
| M1 | One guide, B default/A fallback | `index.html`, `js/app.js`, checksum-pinned installer, `MODEL_LICENSE.md` | Implemented; visual device check pending |
| M1 | Neutral LLM/STT/TTS adapters, server-only keys | `lib/providers.js`, `/api/plan`, `/api/stt`, `/api/tts`, adapter tests | Implemented; live paid services not called in CI |
| M1 | Text, push-to-talk, TTS, lip sync, six actions | `js/app.js`, `vrm-actor.js`, `actions.json` | Implemented; browser/Quest timing check pending |
| M2 | Movable/scalable tray and 25–35 licensed GLBs | `world-tray.js`, 30-item `ASSET_MANIFEST.json`, generator | Implemented; Quest ergonomics pending |
| M2 | Selection, direct transform, Scene Graph serialization | `js/app.js`, `scene-store.js`, Inspector | Implemented |
| M3 | Exactly 15 approved Scene Tools with schemas and stable errors | `tool-registry.js`, `SCENE_TOOL_REFERENCE.md`, tests | Implemented |
| M3 | ID, bounds, scale, capacity and severe-overlap safety | Tool registry and core tests | Implemented |
| M4 | Understand → Plan → Validate → Execute → Inspect → Repair → Speak | `agent-loop.js`, Timeline | Implemented |
| M4 | 14-command budget, max two repairs, rollback, targeted follow-up | Agent Loop and tests | Implemented |
| M4 | Manual transform writes back; no hidden chain-of-thought | `pocket-manual-transform`, public tool events only | Implemented |
| M5 | Desktop fallback, immersive AR, controller and hand paths | `index.html`, `world-tray.js` | Implemented in code; real Quest pending |
| M5 | Permission/network/timeout/device/performance QA | fallback tests and `QUEST_VALIDATION.md` | Desktop/provider automation partial; device evidence pending |
| M6 | Guided demo, Replay, garden, Save/Load, timeline | UI, fixture and automated demo test | Implemented |
| M6 | README, architecture, notices, licenses, one-command start | repository root and `docs/` | Implemented |
| M6 | 90–120 second script and recording | `DEMO_SCRIPT.md` | Script implemented; recording pending device |

## Honest completion boundary

The software portion that can be built and tested in this environment is implemented and covered by automated checks. The project is **not allowed to claim final Quest completion** until the unchecked items in `QUEST_VALIDATION.md` have real-device screenshots, recording and performance evidence.
