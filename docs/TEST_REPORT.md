# Test Report

Build date: 2026-08-31.

## Automated

Command: `npm run test:all`

- Core and server tests: 21 passed, 0 failed.
- Validated all 15 allowed tool names.
- Validated 30 catalog entries and 30 generated GLB headers.
- Validated JavaScript syntax across app, core, server, scripts and tests.
- Completed the required offline garden creation and targeted follow-up in Node.
- Confirmed repair termination after the configured maximum.
- Confirmed failed command batches roll back before Repair.
- Confirmed neutral STT/TTS adapters and server routes without exposing credentials to browser code.
- Confirmed old saved scenes gain a safe avatar transform and a hidden, offset tray during hydration.
- Confirmed deterministic `StepForward`, `StepBack` and `Jump` intent routing.
- Confirmed legacy `STT_PROVIDER=browser` configurations automatically gain server transcription when a compatible API key exists.
- Statically checked Quest laser/controller entities, avatar grab targets, XR HUD and A/X/B/Y bindings.

## Desktop smoke

- Server `/api/health`, `/api/plan` and static `index.html` are exercised by automated HTTP tests.
- Visual/browser interaction still requires a browser session. This environment did not have a compatible browser executable, so automated HTTP success is not represented as visual QA.

## Quest

Not run: no real device was connected. See `QUEST_DEVICE_GUIDE.md` for operation and `QUEST_VALIDATION.md` for the exact human verification pass.
