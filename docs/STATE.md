---
title: State
updated: 2026-04-19
status: current
domain: context
---

# State — as of 2026-04-19

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
- Node unit tests for ECS systems, track, game logic (898 passing)
- Browser screenshot tests: cockpit (4-tier), track, zone banners, title screen, mid-run visual baseline
- Playwright e2e matrix (desktop + mobile viewports) — working with 2 workers
- Maestro flows in `scripts/maestro-all.sh`
- Governor autonomous run via `?governor=1`

### Playthrough telemetry
- `window.__mm.diag()` exposes full run state per-frame: fps, distance, speed, zone, steer, lateral, throttle, target speed, boost/clean counters, trick state, airborne, difficulty, seed phrase, current piece kind, obstacle/pickup counts, camera + worldScroller positions, ECS damage
- `e2e/_factory.ts` drives autoplay via `?autoplay=1&phrase=...&difficulty=...` and dumps `frame-NN.{png,json}` + `summary.json` to `test-results/<id>/playthrough/<phrase>/` at a fixed cadence
- `e2e/seed-playthroughs.spec.ts` runs 3 canon phrases × 3 viewports × 15 frames for deep regression coverage
- `e2e/playthrough-smoke.spec.ts` runs 1 phrase × desktop × 5 frames ≈ 20s total — candidate for future merge-gate once stable
- `scripts/playthrough-governor.ts` (`pnpm playthrough`) is the local-dev counterpart — same URL driver, same artifact layout, dumps to `.test-screenshots/playthrough/<phrase>/`
- CI uploads `playthrough-dumps` artifact (frame PNGs + JSON + summary) on every run, 14-day retention

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

## Active work (as of 2026-04-19)

**Recent merges (today):**
- #166 `useKeyboardControls` → `useTitleKeyboard` rename + editable-target guard + ref-stable listener
- #167 typed `@vitest/browser/context` imports — dropped 8 `@ts-expect-error` directives
- #168 removed stale cockpit-prototype artifacts; Blender re-renders now land in gitignored `.cockpit-prototype/`
- #169 deleted duplicate `src/ui/hud/GameOverOverlay.tsx`; only App's richer overlay mounts now
- #170 deleted orphan `src/ui/TitleScreen.tsx` + its colocated test
- #171 CI uploads `playthrough-dumps` artifact
- #172 `scripts/playthrough-governor.ts` now uses the autoplay URL (previously broken since #170)
- #173 enriched `__mm.diag()` dump — difficulty, seedPhrase, throttle, targetSpeedMps, airborne, trickActive, scaresThisRun, maxComboThisRun, raidsSurvived, ecsBoostRemaining, ecsCleanSeconds
- #174 fast single-seed playthrough smoke spec (merge-gate candidate)
- #175 deleted flaky `visual-regression.spec.ts` — root cause of 50+ min CI stalls
- #176 README "Playthrough telemetry" section

**Track C** (next PR): wire the orphan code — RunPlan canonical path, obstacle/pickup systems, raid director, audio conductor.

---

## Known issues

- iPhone 14 Pro + mid-tier Android FPS: unverified (no real-device baseline)
- release-please GitHub Actions PR permission not yet enabled in repo settings (requires manual repo settings change — see DEPLOYMENT.md)
- CI E2E job was stalling 50+ min because `visual-regression.spec.ts` pinned baselines were hand-drawn landing art (100% pixel mismatch → 30s timeout → retries → browser crash cascade). Spec deleted in #175; watching the next few runs to confirm the fix.
- Android Maestro CI job is flaky on every PR (ADB daemon connect failures before the flow can start). Treat as known non-blocking infra flake; merges on other green checks.

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
