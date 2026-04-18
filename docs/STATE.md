---
title: State
updated: 2026-04-18
status: current
domain: context
---

# State — as of 2026-04-18

## What is done

### Core engine
- koota ECS world with full trait set (`src/ecs/world.ts`, `src/ecs/traits.ts`)
- ECS systems: player motion, track advance, collision, game-over
- R3F scene tree: cockpit, WorldScroller, Track, Environment, PostFX
- Cockpit POV camera parented to cockpit group (sail-glitch impossible)
- `useResponsiveFov` — mobile portrait FOV fix (confirmed)

### Track + zones
- Procedural track geometry from tunables.json archetypes + seed
- Zone system (4 zones: Midway Strip, Balloon Alley, Ring of Fire, Funhouse Frenzy)
- Zone banners (`render/ZoneBanners.tsx`) — tested
- Daily route seed (`src/track/dailyRoute.ts`)

### Cockpit
- Polka-dot hood (procedural texture)
- Steering wheel with banking animation
- Cockpit damage FX (`CockpitDamageFX.tsx`)
- Diegetic HUD (in-world gauges)
- Responsive cockpit scale across phone/tablet/foldable/desktop

### Game logic (compiled, mostly unwired)
- Run plan builder (`src/game/runPlan.ts`) — builds complete obstacle/pickup/critter layout at startRun
- Combo system (`src/game/comboSystem.ts`)
- Trick system (`src/game/trickSystem.ts`)
- Damage levels (`src/game/damageLevel.ts`)
- Difficulty + difficulty telemetry (`src/game/difficulty.ts`, `difficultyTelemetry.ts`)
- Ghost replay input trace (`src/game/replayRecorder.ts`)
- Optimal path / racing line solver + ghost overlay

### Obstacle + pickup layers (compiled, unwired)
- `ObstacleSystem`, `PickupSystem` — render-ready, not imported by App.tsx
- `BalloonLayer`, `MirrorLayer`, `FireHoopGate`, `RaidLayer` — compiled, not wired
- `BarkerCrowd`, `StartPlatform`, `FinishBanner` — compiled, not wired
- `RacingLineGhost` — compiled, not wired
- `conductor.ts` — audio sequencer compiled, not called from GameLoop

### Audio buses
- `audioBus.ts`, `buses.ts`, `honkBus.ts`, `tireSqueal.ts` — compiled
- `sf2.ts` — SF2 sampler via spessasynth_lib — compiled
- `conductor.ts` — phrase grammar — compiled
- Not yet wired into run start/stop lifecycle

### Persistence
- Full drizzle-orm schema (`src/persistence/schema.ts`)
- CapacitorSQLite + sql.js drivers (`src/persistence/dbDrivers.ts`)
- Profile, replay, lifetime stats, achievements, preferences, tutorial — all implemented
- Wired to `runEndPersistence.ts` on run end

### HUD + UI
- `AchievementToasts`, `GameOverOverlay`, HUD panels
- Title screen (`TitleScreen.tsx`)
- Design system: tokens, typography, shared components (`src/design/`)

### Testing
- Node unit tests for ECS systems, track, game logic
- Browser screenshot tests: cockpit, track, zone banners, title screen
- Playwright e2e matrix (desktop + mobile viewports) — working with 2 workers
- Maestro flows in `scripts/maestro-all.sh`
- Governor autonomous run via `?governor=1`

### Port status
- Reference → v2 port: **complete** (PR #21 merged)
- `reference/` directory: deleted
- All reference logic compiled into v2 modules

---

## What is NOT done (Track C — wire the orphan code)

These modules compiled successfully in PR #21 but nothing imports them in the live `App.tsx`. They are "dark code." See `docs/gap-analysis/PLAN.md` Track C for the full wiring plan.

| Module | Status |
|--------|--------|
| `src/game/runPlan.ts` → drives spawns | Live `seedContent` not replaced yet |
| `ObstacleSystem` + `PickupSystem` | Compiled, not imported |
| `StartPlatform` + `FinishBanner` | Compiled, not imported |
| `RaidDirector` | Compiled, not wired into GameLoop |
| `BalloonLayer` / `MirrorLayer` / `FireHoopGate` | Compiled, not gated by zone |
| `conductor.ts` | Compiled, not called on run start |
| `BarkerCrowd` | Compiled, not in scene |
| `replayRecorder` | Compiled, not wired |
| `RacingLineGhost` | Compiled, not in cockpit scene |
| `src/track/trackComposer.ts` | Decision: DELETE (PLAN.md A5) |

---

## Active work (as of 2026-04-18)

**Track A** (parallel, code agent): fixing P0 ship-blockers:
- Balloon pickup → awards ticket
- Fix silent `.catch(() => {})` swallowers
- Fix release.yml unsigned-APK silent fallback

**Track B** (this PR): closing all docs gaps identified in `docs/gap-analysis/docs.md`.

**Track C** (next PR): wire the orphan code — RunPlan canonical path, obstacle/pickup systems, raid director, audio conductor.

---

## Known issues

- iPhone 14 Pro + mid-tier Android FPS: unverified (no real-device baseline)
- Visual regression baselines: not yet captured (pending stable cockpit hero pass)
- `@vitest/browser/context` import in 6 test files should be `vitest/browser` (tracked E3)
- `src/game/gameState.ts` is a 788-LOC god module with 5 responsibilities (tracked E5 — risky, deferred)
- `src/utils/constants.ts` still contains TRACK/HONK/STEER magic numbers that should be in tunables.json (tracked E1)
- release-please GitHub Actions PR permission not yet enabled in repo settings (requires manual repo settings change — see DEPLOYMENT.md)

---

## Decision log

| Decision | Rationale |
|----------|-----------|
| Keep live procedural `Track.tsx`, delete `trackComposer.ts` | Track.tsx is working and tested; trackComposer is unmaintained |
| RunPlan becomes canonical path for spawning | Deterministic, seed-reproducible, testable |
| Balloon pickup = +1 ticket (rename behavior) | Keeps ECS kind; aligns with ticket economy |
| Critters: ship from Kenney assets library | CC0, no attribution gap |
| Wire raids as core feature | Raid is the central tension beat of Ring of Fire |
| `src/track/trackComposer.ts` → DELETE next PR | Contradicts architecture rule 3 (no GLB road pieces) |
