---
title: CHANGELOG — Midway Mayhem
updated: 2026-04-20
status: current
domain: technical
---

# Changelog

All notable changes documented per [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/). This project follows [Semantic Versioning 2.0.0](https://semver.org/).

## [Unreleased]

### Added — 2026-04-20 polish + PRQ execution (PRs 208–219)

- Visual-matrix POV regression test: 8 deterministic distance slices (40m–480m) captured at real integration (App + Cockpit + TrackContent + feature layers) with pinned baselines + 30%-tolerance node-side diff (PRs 209, 212, 213).
- Pause UX: fullscreen PAUSED overlay + always-visible pause button (‖‖) in top-right. Esc/P on desktop, tap on mobile. PRQ task B2 (PR 218).
- Road-to-1.0 PRQ at `docs/prd/ROAD_TO_1_0.prq.md` — 39 tasks across 8 tracks (visual identity, gameplay, audio, persistence, stability, app store, docs, testing), ready for `/task-batch` (PR 216).

### Changed — 2026-04-20 visual polish + autopilot fixes

- Governor autopilot no longer pins steer to ±1 (PR 211/215). Root cause: compared world-space lane center (with track curve offset) against track-relative player lateral, so curved track segments always produced massive offset. Also no longer synthesizes keyboard events — writes continuous steer directly to the Steer trait so the wheel rim rotates proportionally instead of snapping to 90°.
- StartPlatform sign moved from back-edge to front-edge of the platform (PR 214). Previously the sign-back plane rendered ~5m in front of the driver on spawn, a big red wall filling the POV.
- Diegetic speedometer shrunk from fontSize 0.28 → 0.12 (PR 210) and SCORE text from 0.12 → 0.09 (PR 211); neither dominates the track view anymore.
- Camera y dropped 1.72 → 1.55 and hood heightScale raised 0.4 → 0.6 (PR 217, PRQ task A2). The polka-dot hood now fills the lower third of the POV instead of being a sliver at the bottom.
- `stepGameOver` distinguishes `'plunge'` (off-track) from `'damage'` (3-hit crash) — separate EndReason, "MELTDOWN" overlay vs "WIPEOUT" (PR 208).

### Fixed — 2026-04-20

- CI Browser Snapshot Tests job was silently red on every PR for ~40 PRs; now enforces all 49 browser tests (PR 208). Addressed 4 latent failures: App.browser `toDataURL` of a cleared buffer, TrackScroller not reporting real trackPieces count, harness screenshot timing-out on frameloop=always, `stepGameOver` not reading `RunSession.gameOver`.
- TireSquealSystem halted the game with MAYHEM HALTED modal on `?autoplay=1` paths because no user gesture had unlocked the AudioContext. `init()` now returns false on buses-not-ready and `update()` retries (PR 214).
- Audio-bus init race in autoplay tests (PR 214).

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
