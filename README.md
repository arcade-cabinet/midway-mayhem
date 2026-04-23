---
title: Midway Mayhem — Clown Car Chaos
updated: 2026-04-19
status: current
domain: product
---

[![CI](https://github.com/arcade-cabinet/midway-mayhem/actions/workflows/ci.yml/badge.svg)](https://github.com/arcade-cabinet/midway-mayhem/actions/workflows/ci.yml)
[![release-please](https://img.shields.io/badge/release-please-green?logo=google)](https://github.com/arcade-cabinet/midway-mayhem/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

# Midway Mayhem: Clown Car Chaos

> **Drive fast. Honk louder.**

Cockpit-perspective arcade driver. You race a polka-dot clown car down a Hot Wheels mega-track inside a circus big-top. Dodge carnival-themed hazards, collect tickets and boosts, and keep the crowd HYPED before your SANITY runs out.

![Cockpit inside the big-top](docs/screenshots/cockpit-bigtop.png)

---

## Quick start

```bash
pnpm install       # install deps (requires pnpm 10+)
pnpm dev           # Vite dev server → http://localhost:5173/midway-mayhem/
pnpm test          # node + jsdom tests (fast)
pnpm build         # production web bundle → dist/
```

URL flags (dev + test):

| Flag | Effect |
|------|--------|
| `?skip=1` | Skip title screen, drop into gameplay immediately |
| `?governor=1` | Yuka.js autonomous driver plays the game |
| `?diag=1` | (legacy) `window.__mm.diag()` is now always installed; the flag is a no-op but accepted for test URLs |

---

## Feature matrix

| Feature | Status |
|---------|--------|
| Cockpit POV camera | Shipped |
| 4 zones (Midway Strip / Balloon Alley / Ring of Fire / Funhouse Frenzy) | Shipped |
| 5 critter/obstacle types + HONK flee mechanic | Shipped |
| Trick system (airborne rotations) | Shipped |
| Ringmaster raids (telegraphed hazard events) | Shipped |
| Seed phrase NEW RUN modal + 3×2 difficulty grid + permadeath toggle | Shipped |
| Dual-channel deterministic PRNG (track + events) | Shipped |
| Pre-baked run plan (every obstacle/pickup/critter/ramp placed at startRun) | Shipped |
| Optimal-line solver: racing-line cleanliness scoring + ghost overlay + difficulty telemetry | Shipped |
| Start platform + checkered finish banner + plunge-past-track animation | Shipped |
| Replay ghost (input-trace of best run) | Shipped |
| 20 achievements + lifetime stats + ticket shop + cosmetic unlocks | Shipped |
| Big Top Tour mode | Shipped |

---

## Screenshots

| Midway Strip — desktop | Phone portrait |
|------------------------|----------------|
| ![Midway Strip desktop](docs/screenshots/alignment/desktop.png) | ![Phone portrait](docs/screenshots/alignment/phone-portrait.png) |

| Phone landscape | Tablet portrait |
|-----------------|-----------------|
| ![Phone landscape](docs/screenshots/alignment/phone-landscape.png) | ![Tablet portrait](docs/screenshots/alignment/tablet-portrait.png) |

---

## Commands

```bash
pnpm dev                # Vite dev server
pnpm build              # production web bundle
pnpm build:native       # Capacitor-targeted bundle (base='./')
pnpm lint               # Biome check
pnpm typecheck          # tsc --noEmit
pnpm test               # node + jsdom (fast)
pnpm test:browser       # real Chromium WebGL tests
pnpm e2e                # full Playwright matrix — smoke + nightly combined
pnpm e2e:smoke          # fast merge-gate subset (what CI runs on every PR)
pnpm e2e:nightly        # deep telemetry suite (scheduled nightly on main)
pnpm playthrough        # autonomous interval-capture playthrough (see below)
pnpm playthrough:self   # same, but self-hosts a preview server (no `pnpm dev` needed)
pnpm capture:marketing  # 12-pose marketing screenshot capture
```

---

## Playthrough telemetry

The playthrough governor launches the real app via `?autoplay=1`, samples
`window.__mm.diag()` + a PNG screenshot at a fixed cadence, and dumps
everything to `.test-screenshots/playthrough/<phrase>/frame-NN.{png,json}`
with a `summary.json` listing first/last diag and any console errors.

```bash
# In one terminal:
pnpm dev

# In another:
pnpm playthrough                               # defaults: neon-polkadot-jalopy, plenty, 2s × 10 frames
pnpm playthrough -- --phrase molten-checkered-parade --max-frames 20
pnpm playthrough:self                          # skip `pnpm dev` — governor builds + hosts preview
```

Each `frame-NN.json` carries the full diag dump for that moment: fps,
distance, speed, zone, steer, lateral, boost remaining, trick state,
difficulty, seed phrase, obstacle/pickup counts, camera + worldScroller
positions, and more. Diff two runs of the same seed to see exactly
where behaviour changed.

The same interval-capture runs under `e2e/seed-playthroughs.spec.ts`,
tagged `@nightly` — it executes on the scheduled nightly workflow
(`.github/workflows/e2e-nightly.yml`) and publishes the
`playthrough-dumps-nightly` artifact. PR CI runs only the fast smoke
subset (`e2e/playthrough-smoke.spec.ts` — single seed, 5 frames, ~20s)
so the merge gate stays quick and reliable; run `pnpm e2e:nightly`
locally if you want the deep coverage on demand.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| 3D engine | React Three Fiber 9 + drei 10 |
| Post-processing | @react-three/postprocessing (Bloom, Vignette, CA, Noise) |
| Audio | Tone.js procedural + spessasynth_lib SF2 sampler |
| AI driver | Yuka.js steering behaviors |
| Native | Capacitor 8 (Android + iOS) |
| Persistence | CapacitorSQLite + sql.js + drizzle-orm |
| Validation | zod |
| Build | Vite 6 + TypeScript 6 + pnpm |
| Lint/format | Biome 2 |
| Unit tests | Vitest (node + jsdom + browser) |
| E2E tests | Playwright (desktop + mobile matrix) |
| Native smoke | Maestro |

---

## Keyboard controls

| Key | Action |
|-----|--------|
| `←` / `A` | Steer left |
| `→` / `D` | Steer right |
| `Space` | HONK |
| `H` | HONK (alt) |

On mobile/touch: drag pointer left/right to steer; tap HONK button.

---

## Zones

Each zone cycles every ~450 track-metres, changing obstacles, lighting, and ambient music:

1. **The Midway Strip** — warm amber, carousel waltz, sawhorses + cones
2. **Balloon Alley** — pastel sky, gates require precision threading
3. **Ring of Fire** — deep red, hammer hazards, no forgiveness
4. **Funhouse Frenzy** — strobing neon mirrors, highest obstacle density

---

## Docs

| Doc | Purpose |
|-----|---------|
| [CLAUDE.md](CLAUDE.md) | Agent entry point — critical rules, commands |
| [AGENTS.md](AGENTS.md) | Extended operating protocols + architecture |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Rendering pipeline, data flow, build output |
| [docs/DESIGN.md](docs/DESIGN.md) | Product vision, brand, palette, pillars |
| [docs/TESTING.md](docs/TESTING.md) | 4-tier test pyramid, conventions, coverage |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Web + Android + iOS pipeline |
| [docs/LORE.md](docs/LORE.md) | World, characters, zones, credits |
| [docs/STATE.md](docs/STATE.md) | Current state, known issues, decisions log |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Queued features, execution model |

---

## Legal

- [Privacy Policy](public/privacy.html) — Zero data collection. Everything stays on your device.
- [Terms of Service](public/terms.html) — MIT License, as-is warranty disclaimer.
- [Legal Landing](public/legal/) — Summary of all legal documents.

All documents are served as static HTML for app store compliance (iOS + Android). No cookies, no tracking, no external calls.

---

## License

Code: MIT. Assets: Kenney Racing Kit CC0, PolyHaven `circus_arena` HDRI CC0.
See [docs/LORE.md#credits](docs/LORE.md#credits).

---

## Maintainer

https://github.com/arcade-cabinet/midway-mayhem
