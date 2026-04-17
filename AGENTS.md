---
title: AGENTS.md — Midway Mayhem Operating Protocols
updated: 2026-04-16
status: current
domain: technical
---

# Agent Operating Protocols

Extended rules + architecture for agents working on Midway Mayhem. Read after `CLAUDE.md`.

## Origin + vision reconciliation

Midway Mayhem is the R3F reimagining of the single-file HTML prototype the user iterated through Gemini (7 visual-refinement rounds) then ChatGPT (elevation pass, brand lock, full architecture prompt). Both conversation dumps are INPUT, not artifacts — the user's redirects across them are the design spec. See `docs/DESIGN.md` for the fully-reconciled vision.

Key alignment rules baked into the codebase:

- The HTML POC's polka-dot clown-car identity is PRESERVED.
- The 5 recurring bugs Gemini couldn't fully solve (sail-glitch, hood-swallow, mobile FOV, flat hood, group-scale-on-resize) are SOLVED at the architectural level, not worked-around:
  - Camera is a child of `<Cockpit>` → sail-glitch impossible
  - Hood geometry is a capped hemisphere at fixed Z → hood-swallow impossible
  - `useResponsiveFov` widens vertical FOV on portrait → mobile FOV solved
  - WorldScroller translates world past a fixed cockpit → group-scale-on-resize moot
  - Hood/dash/pillars all inside one `bodyRef` group banking together

## Stack lock

| Layer | Choice | Why |
|---|---|---|
| Engine | R3F 9 + drei 10 + postprocessing | marmalade-drops pattern; proven in arcade-cabinet sibling |
| Build | Vite 6 + TypeScript | grailguard pattern |
| Package mgr | pnpm | workspace-friendly |
| Lint/format | Biome 2 | single tool for lint + format |
| Audio | Tone.js | zero-asset procedural |
| Persistence | Capacitor SQLite (native) / sql.js (web) via drizzle-orm | grailguard's db pattern |
| Native | Capacitor 8 (Android + iOS) | CC-supported |
| Testing | Vitest (node+jsdom+browser) + Playwright + Maestro | 4-tier pyramid |
| 3D assets | Kenney Racing Kit (CC0) — BAKED with MM palette | procedural kit avoids asset drift |
| HDRI | PolyHaven circus_arena (CC0) 2K | immersive big-top, one asset does two jobs (lighting + background) |
| ECS | zustand + plain modules (koota reserved for future entity graph) | simple first |
| AI driver | Yuka.js | production TypeScript steering-behavior library |

## Files that must not drift

These three files are the SOURCE OF TRUTH for the palette. If you edit one, edit all:

- `src/utils/constants.ts` → `COLORS` object
- `src/app/global.css` → `--mm-*` CSS variables
- `scripts/bake-kit.py` → `PALETTE` dict (then re-run bake)

## Asset pipeline

```text
/Volumes/home/assets/3DLowPoly/Vehicles/Cars/Racing Kit/*.glb   (source, CC0)
        ↓  scripts/bake-kit.py   (Python via Blender)
public/models/*.glb                                            (baked, tracked in git)
        ↓  src/game/trackComposer.ts + src/components/TrackSystem.tsx
in-game track                                                  (drei useGLTF)
```

The Kenney kit uses named materials (`road`, `grey`, `grass`, `_defaultMat`, etc.) The bake script remaps those to MM-branded materials (`mm_track_orange`, `mm_rail_yellow`, `mm_shoulder_purple`, `mm_marking_white`). Verified palette mapping — see bake-kit.py REMAP dict.

## State model

```text
zustand store (src/systems/gameState.ts)
  session:    running, paused, gameOver, startedAt, seed
  player:     distance, lateral, speedMps, targetSpeedMps, steer
  derived:    hype, sanity, crowdReaction, crashes, currentZone
  boost:      boostUntil, megaBoostUntil

  actions:    startRun, tick(dt, now), pause, resume, endRun,
              applyCrash(heavy), applyPickup(kind), setSteer, setLateral
```

Subscribers: HUD panels (reactive), ZoneBanner (on currentZone change), Cockpit (via useFrame read), GameLoop (tick driver).

## Error handling (HARD-FAIL)

Every throw paths to `src/systems/errorBus.ts`:

- `window.onerror` → reportError
- `window.onunhandledrejection` → reportError
- `<ReactErrorBoundary context="...">` → reportError + componentStack
- asset preloader 404 → reportError with specific path
- audio init failure → reportError (title-screen START triggers it from user gesture)
- WebGL unavailable → thrown from `useDeviceDetection.detect()`

`<ErrorModal>` is always mounted in the App tree. Shows the most recent error's context + message + stack + cause chain + URL + UA + timestamp, with Copy Report / Reload / Dismiss buttons.

## Testing discipline

Every e2e spec asserts `expectNoErrorModal(page)` at entry AND exit. The `error-modal` testid must have count=0 on green paths.

Tests live in:
- `src/**/__tests__/*.test.{ts,tsx}` — node logic
- `src/**/__tests__/ui/*.test.tsx` — jsdom component
- `src/__tests__/*.browser.test.tsx` — real Chromium (WebGL-required stuff)
- `e2e/*.spec.ts` — full Playwright with preview server

See `docs/TESTING.md` for the pyramid + coverage targets.

## Diagnostics surface

All diagnostics surfaces are gated by `DEV || ?diag=1 || ?governor=1`. On a bare `pnpm preview` run (production + no flags) they are **not present**. E2E specs must add `?diag=1` to `page.goto()` if they call `readDiag()`.

`window.__mm` (gated):
- `.diag()` returns a JSON-serializable snapshot of fps/distance/speed/hype/sanity/crashes/crowd/zone/steer/lateral/obstacleCount/pickupCount
- `.setSteer(v)` programmatic steering (governor uses internal path instead)
- `.start()` / `.end()` run control

`window.__mmSpawner` — live ObstacleSpawner reference (governor reads it each tick; gated with `?governor=1` or DEV)
`window.__mmGovernor` — live GovernorDriver (when `?governor=1`)
`window.__mmHonk` — triggers audioBus.playHonk() from anywhere (gated)
`window.__mmRunConfig` — write-only bridge from NewRunModal to Game.tsx; consumed + cleared on first run

## Performance targets

| Device | Budget | Current |
|---|---|---|
| M1 Mac desktop | 60 FPS steady | 60 FPS verified |
| iPhone 14 Pro | 45 FPS minimum | unverified |
| Mid-tier Android | 30 FPS minimum | unverified |

No silent degradation — if a device can't hold target FPS, the ErrorModal gets a perf warning, not a feature downgrade.

## What does NOT live in this repo

- The source Kenney + PolyHaven assets (NAS / upstream). `public/models/` + `public/hdri/` ship BAKED/resolved versions.
- `node_modules/` (obviously)
- Raw conversation dumps (`ChatGPT-*.md`, `Gemini-*.md`). They informed the design and are mirrored into docs; the originals live locally, gitignored.

## Parallel specialists to spawn

When appropriate:
- performance-optimizer for frame-time regressions
- code-reviewer after every epic pass
- security-review before releases (Capacitor surface)

See also: global `~/.claude/CLAUDE.md` for portfolio-wide rules.
