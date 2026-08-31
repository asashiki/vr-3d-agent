# M0 Baseline

Baseline source: `andrewsegas/incarna`, inspected 2026-08-31.

Preserved capabilities:

- A-Frame WebXR scene and Quest `immersive-ar` / passthrough configuration;
- `@pixiv/three-vrm` VRM loading;
- VRMA action loader and `vrm-actor` expressions, blink and lip motion path;
- Quest controllers and direct manipulation foundation;
- zero-dependency Node server that keeps provider keys server-side;
- Action Lab / Studio files remain available for avatar debugging.

Product changes are isolated in `js/core`, `js/components/world-tray.js`, `js/app.js`, the new UI and server provider layer. Offline replay is recorded in `fixtures/garden-replay.json`.

No Quest device was attached to the build environment. Device-only baseline claims remain pending in `QUEST_VALIDATION.md`.
