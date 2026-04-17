---
title: Midway Mayhem — Clown Car Chaos
updated: 2026-04-16
status: current
domain: product
---

# Midway Mayhem: Clown Car Chaos

> Drive fast. Honk louder.

Cockpit-perspective arcade driver. You race a polka-dot clown car down a Hot Wheels mega-track inside a circus big-top. Avoid obstacles, grab boosts, collect tickets, don't lose your SANITY before the crowd does.

![Cockpit inside the big-top](docs/screenshots/cockpit-bigtop.png)

## Quick start

```bash
pnpm install
pnpm dev
```

URL flags:
- `?skip=1` — skip title screen
- `?governor=1` — autonomous Yuka.js driver
- `?diag=1` — expose `window.__mm.diag()` for telemetry

## Commands

```bash
pnpm dev                # vite dev server
pnpm build              # production web bundle
pnpm build:native       # capacitor-targeted bundle
pnpm lint               # biome check
pnpm typecheck          # tsc --noEmit
pnpm test               # node + jsdom (fast)
pnpm test:browser       # real Chromium WebGL
pnpm test:e2e           # full Playwright matrix (desktop + mobile)
```

## Tech

- React 19 + React Three Fiber + drei + @react-three/postprocessing
- Vite 6 + TypeScript + pnpm + Biome
- Tone.js procedural audio (zero samples)
- Capacitor 8 for Android + iOS
- Vitest (node+jsdom+browser) + Playwright with Yuka.js autonomous governor
- Kenney Racing Kit (CC0) models baked with brand palette via `scripts/bake-kit.py`
- PolyHaven `circus_arena` HDRI (CC0) as the immersive big-top environment

## Docs

- [CLAUDE.md](CLAUDE.md) — agent entry point
- [AGENTS.md](AGENTS.md) — extended operating protocols + architecture
- [STANDARDS.md](STANDARDS.md) — non-negotiable standards
- [CHANGELOG.md](CHANGELOG.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — rendering pipeline, data flow, build output
- [docs/DESIGN.md](docs/DESIGN.md) — product vision, brand, palette, pillars
- [docs/TESTING.md](docs/TESTING.md) — 4-tier test pyramid, conventions, coverage
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — web + Android + iOS pipeline
- [docs/LORE.md](docs/LORE.md) — world, characters, zones, credits
- [docs/STATE.md](docs/STATE.md) — current state, what's next, decisions log
- [docs/plans/midway-mayhem.prq.md](docs/plans/midway-mayhem.prq.md) — full PRD (9 epics, 54 tasks)

## License

Code MIT. Assets: Kenney Racing Kit CC0, PolyHaven circus_arena CC0. See [docs/LORE.md#credits](docs/LORE.md#credits).
