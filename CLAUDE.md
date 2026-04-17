---
title: CLAUDE.md — Midway Mayhem
updated: 2026-04-16
status: current
domain: technical
---

# Midway Mayhem — Agent Entry Point

> Drive fast. Honk louder.

Cockpit-perspective arcade driver where you race a polka-dot clown car down a Hot Wheels mega-track inside a circus big-top.

## Critical rules

1. **Hard-fail, no fallbacks.** Every error surfaces in `<ErrorModal>` via `errorBus.reportError`. No `try { ... } catch { /* ignore */ }`, no perf-tier branches, no "if asset loaded use it else procedural". See `src/systems/errorBus.ts`.
2. **TypeScript everywhere.** Source, tests, build scripts, configs. Only exemption: `bpy` Blender scripts (Python-required) and harness hooks (bash).
3. **Grailguard + marmalade-drops are references.** For any Vite/R3F/drei/Capacitor/test/build problem check `../grailguard/` and `../marmalade-drops/` BEFORE inventing.
4. **Retexture at BAKE time, not RUNTIME.** Model palette is baked via `scripts/bake-kit.py` into `public/models/`. Zero runtime retex code.
5. **Camera lives inside the cockpit group.** No world-space camera following a separate car — eliminates the "sail glitch" and "hood-swallows-camera" classes entirely.
6. **HDRI is the world.** The circus_arena HDRI from PolyHaven is the BIG-TOP — full 360° × 180° immersion, not a skybox half-shell.

## Commands

```bash
pnpm install              # fresh setup
pnpm dev                  # vite dev server
pnpm build                # production web bundle
pnpm build:native         # capacitor-targeted bundle
pnpm lint                 # biome check
pnpm typecheck            # tsc --noEmit
pnpm test                 # node + jsdom
pnpm test:browser         # real Chromium with WebGL
pnpm test:e2e             # playwright full matrix (desktop + mobile)
```

## URL flags (dev + test)

- `?skip=1` — skip title screen, drop into gameplay
- `?governor=1` — Yuka.js autonomous driver plays the game
- `?diag=1` — exposes `window.__mm.diag()` for diagnostics

## Project structure (load-bearing modules)

```
src/
  app/             App entry, global CSS
  assets/          manifest.ts (typed declarative), preloader (hard-fail)
  components/      Game, Cockpit, TrackSystem, ObstacleSystem, PickupSystem,
                   HUD, TitleScreen, ErrorModal, ReactErrorBoundary, PostFX, …
  game/            trackComposer.ts (snap-to-grid track assembly),
                   pbrMaterials.ts (optional PBR factories)
  hooks/           useSteering, useShake, useResponsiveFov, useDeviceDetection
  systems/         gameState (zustand), errorBus, diagnosticsBus,
                   obstacleSpawner, collisionSystem, zoneSystem,
                   trackGenerator (mathematical spline — legacy),
                   audioBus (Tone.js procedural),
                   governor/Governor + GovernorDriver (yuka AI)
  utils/           constants, math, rng (splitmix64), proceduralTextures
public/
  hdri/            circus_arena_2k.hdr — the big-top interior
  models/          Kenney Racing Kit baked with MM brand palette
  textures/        PBR maps for cockpit chrome + hood (optional)
scripts/
  bake-kit.py      Baker: Kenney default palette → MM brand palette
  copywasm.ts      Copies sql-wasm.wasm into public/
e2e/
  boot.spec.ts, gameplay.spec.ts, governor.spec.ts,
  errorModal.spec.ts, mobile.spec.ts, helpers.ts
```

## Where to look first

- Extended protocols + architecture: `AGENTS.md`
- Hard rules: `STANDARDS.md`
- What changed when: `CHANGELOG.md`
- Full stack + data flow: `docs/ARCHITECTURE.md`
- Brand + palette + UX laws: `docs/DESIGN.md`
- Testing strategy: `docs/TESTING.md`
- World + narrative: `docs/LORE.md`
- Current state: `docs/STATE.md`
- Deploy matrix: `docs/DEPLOYMENT.md`
- The epic plan: `docs/plans/midway-mayhem.prq.md`
