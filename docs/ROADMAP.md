---
title: Roadmap
updated: 2026-04-17
status: current
domain: context
---

# Roadmap

Everything committed to ship in PR #2. No deferrals. Each item is a tracked TaskList entry; status tracked there.

## Landed in this PR

| # | Feature | Status |
|---|---------|--------|
| 15 | Full latest-deps bump + Dependabot vuln patches (vite 8, TS 6, plugin-react 6, three 0.183, happy-dom 20) | ✅ |
| 16 | All CodeRabbit review feedback resolved (36 comments → 0 blocking) | ✅ |
| 17 | SF2 sampled sweetener via spessasynth_lib through musicBus | ✅ |
| 18 | Drop-in intro GIF capture harness | ✅ |
| 20 | Clown-car cockpit strip — dead gauges removed, seat lip visible | ✅ |
| 21 | HONK mechanic — live critters flee + pratfall tumble + crowd bonus | ✅ |
| 22 | Subpackages + JSON tunables design (`docs/plans/architecture-subpackages.md`) | ✅ |
| 23 | Plunge-off-ramp fail + progressive damage + multicolor explosion | ✅ |
| — | Full governance workflow suite (ci.yml / cd.yml / release.yml / dependabot) aligned with grailguard | ✅ |
| — | Release-please wired for conventional commits → tagged releases | ✅ |
| — | GitHub Pages deploy on push-to-main | ✅ |
| — | Android debug APK artifact on CD run (pending `cap add android` — see TODO in cd.yml) | ⏳ |

## Queued for PR #2 (next-wave — autonomy granted, shipping when done)

**Gameplay depth**

| # | Feature |
|---|---------|
| 24 | Combo meter (CROWD CHAIN) — 1×/2×/4×/8× multiplier on scare+pickup chains |
| 25 | Trick system — airborne rotations off ramps for bonus + sanity refill |
| 26 | Zone gimmicks — balloons/fire hoops/mirror duplicates/barkers per zone |
| 27 | Ringmaster raids — telegraphed hazard events every ~30s |

**Persistence + meta**

| # | Feature |
|---|---------|
| 28 | Ticket shop + persistence schema (drizzle + CapacitorSQLite) |
| 29 | Daily route — UTC-seeded track + local leaderboard |
| 33 | Cockpit customization (persistent loadout) |
| 34 | Replay ghost — input-trace of best run racing alongside |

**Feel + virality**

| # | Feature |
|---|---------|
| 30 | Photo mode on game-over — 360° pan + PNG download |
| 31 | Speed-feel pass — tire squeal + wind + vignette + idle rumble |
| 32 | Big Top Tour — standalone walkaround mode with collectibles |

**Architecture + tooling**

| # | Feature |
|---|---------|
| 35 | JSON tunables migration — public/config/tunables.json, zod-validated |
| 36 | Barrel pattern — @/audio, @/obstacles, @/cockpit, @/config aliases |
| 37 | Marketing screenshot capture — 12 curated poses |
| 38 | Title-screen 3D start sequence — replace 2D polka-dot logo |
| 39 | Maestro native smoke scripts (Android + iOS) |

## Execution model

- Everything lands in one PR. No stacking, no feature-branch hell.
- Parallel agent streams own non-overlapping files.
- Tests green at every commit; visual regression baselines regenerated as needed.
- Merge happens when every queued item has an owning commit + passing tests.
- No scope deferral. Autonomy is granted; judgment calls made in-flight.

## Definition of ship

1. `pnpm lint && pnpm typecheck && pnpm test` passes
2. `pnpm test:browser` passes
3. `pnpm test:e2e` passes (all projects including visual)
4. Production `pnpm build` succeeds with warnings under threshold
5. CodeRabbit has 0 remaining major/critical comments
6. Squash-merge to main → release-please opens a release PR → merge → CD deploys to GitHub Pages + releases an APK artifact

## Out-of-scope for this PR

- Multiplayer. Ever. This is a single-player arcade.
- Cloud leaderboard / accounts. Everything local.
- Cosmetic monetization. Tickets are in-game-only.
