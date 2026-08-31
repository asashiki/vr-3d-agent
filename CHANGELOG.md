# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Continuous integration (GitHub Actions): syntax check, JSON validation, and a boot
  smoke test on every push/PR. Informational — it does not gate merges.
- Rewritten README with a visual tour, badges, and starter media (`docs/media/`).

## [0.4.0] — 2026-07-24

### Added
- **The Board** — the agent can show a floating, draggable **Markdown panel**
  (tables, lists, reports) via a `<<<incarna:panel … >>>` block, while speaking a
  short summary. Safe, dependency-free Markdown renderer; auto-detect fallback when
  the agent doesn't wrap the block. See `docs/panels.md`.
- **Studio** (`studio.html`) — one place to configure and test, in three tabs:
  **Roster** (bind an OpenClaw agent to an avatar + voice + seat and save),
  **Avatars** (preview/upload `.vrm`, test emotions and every `.vrma`), and
  **Actions** (curate/test the body-action catalog).
- Config is now **writable from the UI**: `GET/POST /api/config` reads and saves
  `agents.local.json` with a hot reload (no restart). Guarded by `ALLOW_DEV_WRITES`.
- **ElevenLabs voice picker** with preview: `GET /api/voices`.
- Redesigned **"Your office"** home hub: richer cards (seat + live incarnate swap),
  an "Add agent" shortcut to the Studio, and a guided empty state for first-run.
- **Project infrastructure**: `CHANGELOG.md`, `MAINTAINERS.md`, `ROADMAP.md`,
  `SUPPORT.md`, `CODEOWNERS`, GitHub issue forms, and `.editorconfig`.

### Changed
- `agents.example.json` now ships with **no agents**, so a fresh clone lands on the
  guided empty state instead of a placeholder.
- Renamed the Lab to the **Studio** (`lab.html` → `studio.html`); updated all links and docs.

## [0.3.0] — 2026-07-23

### Added
- **Action Lab / config console**: pick & upload `.vrm` avatars, browse/upload every
  `.vrma`, wire new actions, and test them live (`/api/assets`, `/api/upload`).
- **Incarnate picker**: choose which live OpenClaw agent wears an avatar
  (`/api/openclaw-agents`), with the session keyed by brain so history follows.
- Author attribution across the app and README.

## [0.2.0] — 2026-07-23

### Changed
- **Talk directly to agents.** Removed the OpenAI persona middleman from the
  conversation; the app calls the selected OpenClaw agent directly.
- **Persistent memory** via a stable session (`user: "incarna:<id>"`), and a stapled
  voice/output preamble so replies stay short and can drive the body — with no
  changes to the agent itself. OpenAI is used only for speech-to-text.

## [0.1.0] — 2026-07-23

### Added
- Initial public release: talking VRM avatars in passthrough MR (WebXR / Quest 3),
  driven by voice; config-driven agents; multi-avatar office with gaze targeting;
  grab-to-move; press-to-talk state machine with audible+visual error feedback; and a
  zero-dependency Node proxy that keeps API keys server-side.

[Unreleased]: https://github.com/andrewsegas/incarna/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/andrewsegas/incarna/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/andrewsegas/incarna/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/andrewsegas/incarna/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/andrewsegas/incarna/releases/tag/v0.1.0
