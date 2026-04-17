---
title: CLAUDE.md — Midway Mayhem
updated: 2026-04-17
status: current
domain: technical
---

# Midway Mayhem — Agent Entry Point

> Drive fast. Honk louder.

Cockpit-perspective arcade driver down a Hot Wheels mega-track inside a circus big-top. Web build is debug-only; the shipped targets are Capacitor iOS + Android.

## How this repo is structured right now

- `src/` — the v2 rewrite. Empty shell bootstrapping: koota ECS, JSON-driven
  config, procedural track, responsive cockpit group. Being built stepwise:
  (1) test harness (2) track (3) cockpit (4) landing. Each step is gated by
  passing visual-capture tests before moving on.
- `reference/` — the entire v1 codebase. Preserved for lookups only. Do NOT
  import from here. Do NOT refactor inside here. Read it to remember how
  something was done, then build fresh in `src/`.

## Architecture rules (v2)

1. **`.ts` = logic. `.tsx` = rendering. `.json` = data.** If a number
   appears in `.ts`, it came from JSON. If math is in `.tsx`, it's wrong.
2. **One koota world is the entire state boundary.** Everything that was
   a zustand store is now an entity with traits. Queries, not hooks.
3. **Procedural everything.** No GLB road pieces. Track geometry is
   generated deterministically from JSON archetypes + seed, shaded with
   PBR materials (PolyHaven).
4. **Hard-fail, no fallbacks.** Every failure path goes to an error modal.
   No silent catches. No "if asset missing, degrade gracefully."
5. **Test-gated progress.** Each subsystem has browser screenshot tests
   running on the real Chrome GPU (ANGLE/GL, not SwiftShader). A step
   isn't done until its screenshots are right.

## Commands

```bash
pnpm install        # fresh setup
pnpm dev            # vite dev server (localhost:5173/midway-mayhem/)
pnpm build          # production web bundle
pnpm build:native   # capacitor build
pnpm lint           # biome check
pnpm typecheck      # tsc --noEmit
pnpm test           # all projects
pnpm test:node      # logic-only unit tests
pnpm test:browser   # real-GPU Chromium screenshot tests
```

## URL flags (dev only)

- `?debug=1` — expose `window.__mm` diagnostics + `window.__mmCapture()`

## Current layout

```
src/
  app/              App + main entry (composition only)
  ecs/              world.ts, traits.ts, systems/
  render/           R3F components that query traits
  config/           tunables.json + archetypes/*.json + zod schemas
  audio/            procedural Tone.js (no soundfonts)
  utils/            rng, math — tiny utilities only
  test/             scene harness + setup

public/
  hdri/             circus_arena_2k.hdr — the big-top dome
  textures/         PBR maps (chrome, track, hood)
  fonts/            Bangers + Rajdhani
  ui/               background-landing.png (title art)

scripts/
  vite-capture-plugin.ts   # POST /__capture → .capture/<ts>/ on disk
```

## Reference material

- `reference/` — v1 codebase, read-only lookups
- `../marmalade-drops/` — vitest+koota patterns we're mirroring
- `../stellar-descent/` — real-GPU Playwright e2e pattern
- `../grailguard/` — build/test reference
- `koota/examples` (from the koota repo) — reference examples;
  `revade` + `n-body-react` are the closest analogs
