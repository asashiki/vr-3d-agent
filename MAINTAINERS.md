# Maintainers & governance

This document describes who maintains **Incarna** and how the project is run. It
is meant to keep the project healthy and welcoming for the long term, across
many contributors. Please also read [CONTRIBUTING.md](CONTRIBUTING.md) and
[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

## Maintainers

| Name        | GitHub                                     | Role            |
| ----------- | ------------------------------------------ | --------------- |
| Andrews Egas | [@andrewsegas](https://github.com/andrewsegas) | Lead maintainer |

## What maintainers do

- Triage incoming issues and keep the tracker tidy.
- Review and merge pull requests.
- Cut and publish releases.
- Uphold the [Code of Conduct](CODE_OF_CONDUCT.md).
- Steward the [roadmap](ROADMAP.md) and overall direction.

## Decision-making

Governance is intentionally lightweight:

- We prefer **consensus** among maintainers and contributors.
- For significant or contentious changes, discuss them first in an
  [Issue](../../issues) or [Discussion](../../discussions) before writing code.
- When consensus isn't reached, the **lead maintainer has final say**.

## Becoming a maintainer

Maintainership is earned through:

- Sustained, high-quality contributions.
- Helpful, respectful reviews and issue triage.
- Alignment with the project's values and direction.

Existing maintainers invite new maintainers by consensus.

## Releases & versioning

- We follow [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`).
- Notable changes are recorded in [CHANGELOG.md](CHANGELOG.md) using the
  [Keep a Changelog](https://keepachangelog.com/) format.
- Releases are tagged `vX.Y.Z`.

## Areas / expertise

A rough map of the project, to help route questions and reviews:

- **Front-end / WebXR** — A-Frame and @pixiv/three-vrm rendering, scene, avatars.
- **Node proxy / API** — the zero-dependency `server.js` and its endpoints.
- **Agent integration** — connecting to [OpenClaw](https://github.com/openclaw) agents.
- **Voice** — text-to-speech via ElevenLabs.
- **Docs** — the [`docs/`](docs/) folder and guides.
