---
title: CHANGELOG — Midway Mayhem
updated: 2026-04-18
status: current
domain: technical
---

# Changelog

All notable changes documented per [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/). This project follows [Semantic Versioning 2.0.0](https://semver.org/).

## [Unreleased]

### Added — v2 port from `reference/`

- Dual-channel PRNG (`createRunRng`) with independent track + events salted streams.
- Human-readable seed phrases (`phraseToSeed`, `shufflePhrase`).
- Persistence layer: SQLite + drizzle + sql.js wasm (web OPFS) + @capacitor-community/sqlite (native). Tables: profile, unlocks, loadout, dailyRuns, replays, achievements, lifetimeStats.
- Audio conductor: Tone.js 3-bus mix with sidechain ducking; CircusConductor phrase grammar; honk/sfx/tireSqueal procedural recipes; spessasynth_lib soundfont support.
- Difficulty tiers (kazoo / plenty / nightmare / ultra-nightmare) + per-tier run plan, optimal path, telemetry.
- Combo + trick + deviation + damage systems.
- Full TitleScreen: NewRunModal, difficulty tiles, seed phrase field, permadeath toggle. Compact layout (phone-portrait) + hero layout (desktop/tablet).
- Panels: Achievements, Settings, HowToPlay, Credits, Stats, TicketShop, ShopRow, Leaderboard, PhotoMode.
- Full in-run HUD: hype / distance / crashes / sanity / crowd / racing-line meter / trick overlay / raid telegraph / game-over overlay / live-region accessibility.
- Cockpit FX: damage flicker + smoke, explosion particles, speed vignette, racing-line ghost, steering-wheel rig.
- Track: StartPlatform (wire-hung NEW GAME launch), FinishBanner, WorldScroller, zone banners per 500m, optimal-path solver.
- Obstacle render layers: BalloonLayer, BarkerCrowd, FireHoopGate, MirrorLayer (funhouse-zone duplicates), RaidLayer (TIGER/KNIVES/CANNONBALL), GhostCar (best-score replay).
- Mobile-first responsive scale: form-factor-aware cockpit drop-in height + plunge clamps, all values in `tunables.json`.
- Deterministic seed test factory (`e2e/_factory.ts`): `runPlaythrough()` dumps per-2s JSON diagnostics + PNG screenshots.
- E2E specs: governor-playthrough, seed-playthroughs (3 canonical phrases), determinism canary, mobile-gameplay (Pixel 7), visual-regression.
- Maestro Android flows: smoke, gameplay-30s, hud-visible, touch-steering, title-panels, critter-scare, ramp-trick, pause-resume, game-over.
- `useSyncExternalStore`-backed `useGameStore` shim — HUD + panels re-render reactively.
- Autoplay governor (`?autoplay=1`) floors throttle + wires to `startRun()`.

### Fixed — v2 port

- Black-void mid-run (two systems writing Position → teleport discontinuities).
- GameOverOverlay opaque backdrop swallowing cockpit.
- sql.js wasm 404 at runtime (copywasm copies wasm to `public/`; dbDrivers fetches from `${BASE_URL}sql-wasm.wasm`).
- Plunge animation dropping camera below ground into a pitch-black void.
- Drop-in animation hoisting cockpit 12m above track.
- Maestro shell script YAML-parse bug (`for FLOW in \` getting collapsed).
- Playwright `tablet-landscape` launching webkit that wasn't installed — swapped to chromium + touch + 1366x1024.
- HUD frozen at zero values because `useGameStore` wasn't subscribing to state changes.

### Structural

- Every module in `reference/src/` ported to `src/` or explicitly dropped (see `docs/porting-map.md`). `reference/` removed.
- Single motion owner: `gameStateTick` writes distance/speed/lateral/score on the Player entity; `stepPlayer` is a no-op while a run is active (keeps isolated tests working).
- Tunables moved from inline `.ts` literals to `src/config/tunables.json` per CLAUDE.md rule "if a number appears in `.ts`, it came from JSON."

## [0.1.0] — 2026-04-16

### Added

- Initial playable commit.
- Cockpit-perspective R3F scene inside full circus_arena HDRI big-top.
- Kenney Racing Kit track pieces baked with Midway Mayhem brand palette via `scripts/bake-kit.py`.
- `trackComposer.ts` snap-to-grid track assembly (start/straight/corner/ramp/end pieces).
- 5-type obstacle system (barrier, cones, gate, oil, hammer) + 3-type pickup system (boost, ticket, mega).
- Yuka.js autonomous governor for e2e playthroughs (`?governor=1`).
- Hard-fail error discipline: global ErrorModal + ErrorBus + React ErrorBoundary.
- Declarative asset manifest + preloader with hard-fail on 404.
- HUD (HYPE / DISTANCE / CRASHES / SANITY / CROWD REACTION) in Bangers + Rajdhani.
- Tone.js procedural audio bus (engine hum, honk, crash, pickup FX).
- Responsive camera FOV for portrait phones.
- Diagnostics bus at `window.__mm.diag()`.
- Camera-parented-to-cockpit architecture (fixes Gemini sail-glitch + hood-swallow bugs at the design level).

### Fixed — lessons from the prototype conversations
- Sail glitch: camera now rides inside the cockpit body group, no world-space chase.
- Hood-swallow: hood is a capped hemisphere at fixed Z never overlapping the dashboard plane.
- Mobile FOV zoom-in: `useResponsiveFov` adapts vertical FOV so horizontal FOV stays ≈90° on portrait.
- Cockpit scale drift on resize: all cockpit meshes live inside one `<Cockpit>` group.

### Stack
- React 19.2, @react-three/fiber 9, @react-three/drei 10, @react-three/postprocessing 3
- Vite 6, TypeScript 5.7, pnpm 10.32
- Biome 2.4, Vitest 4, Playwright 1.51
- Tone.js 15, Yuka 0.7, zustand 5
- Capacitor 8 (Android + iOS)
- drizzle-orm + sql.js + @capacitor-community/sqlite (pinned for persistence work)
