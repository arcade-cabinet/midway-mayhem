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

## Track C (wire the orphan code) — done

All dark code from PR #21 is now wired. Audit confirms imports in live App/GameLoop:

| Module | Status |
|--------|--------|
| `src/game/runPlan.ts` | Wired — drives canonical spawns |
| `ObstacleSystem` | Wired |
| `PickupSystem` | Deliberately a null shell (visuals owned by `TrackContent.tsx`) |
| `StartPlatform` + `FinishBanner` | Wired |
| `RaidDirector` | Wired into GameLoop |
| `BalloonLayer` / `MirrorLayer` / `FireHoopGate` | Wired |
| `conductor.ts` | Started by `useArcadeAudio` on first user gesture; re-keys on zone transition |
| `BarkerCrowd` | Wired |
| `replayRecorder` | Wired |
| `RacingLineGhost` | Wired into cockpit |
| `src/track/trackComposer.ts` | Deleted per PLAN.md A5 |

---

## Active work (as of 2026-04-19)

**Recent merges (today's session, 40 PRs):**

Code cleanup + telemetry foundations:
- #166 `useKeyboardControls` → `useTitleKeyboard` rename + editable-target guard + ref-stable listener
- #167 typed `@vitest/browser/context` imports — dropped 8 `@ts-expect-error` directives
- #168 removed stale cockpit-prototype artifacts; Blender re-renders now land in gitignored `.cockpit-prototype/`
- #169 deleted duplicate `src/ui/hud/GameOverOverlay.tsx`; only App's richer overlay mounts now
- #170 deleted orphan `src/ui/TitleScreen.tsx` + its colocated test
- #171 CI uploads `playthrough-dumps` artifact
- #172 `scripts/playthrough-governor.ts` now uses the autoplay URL (previously broken since #170)
- #173 enriched `__mm.diag()` dump — difficulty, seedPhrase, throttle, targetSpeedMps, airborne, trickActive, scaresThisRun, maxComboThisRun, raidsSurvived, ecsBoostRemaining, ecsCleanSeconds

CI reliability — E2E merge gate went from 90-min stalls to 3-min green runs:
- #174/#180/#182/#183/#184/#186/#188/#189 iterations on the playthrough-smoke spec
- #175 deleted flaky `visual-regression.spec.ts` — root cause of 50+ min CI stalls
- #178 e2e job `timeout-minutes: 20` cap
- #179 split smoke vs nightly + scheduled nightly workflow
- #185 removed `continue-on-error` from three CI jobs — all blocking now except Maestro emulator step
- #187 disabled `preserveDrawingBuffer` in prod (per-frame GPU stall revealed by trace download)
- #191/#192 nightly desktop-only + reduced frames → fits in 45-min cap

Docs:
- #176 README "Playthrough telemetry" section
- #177/#190 STATE.md refresh
- #181 docs/TESTING.md smoke vs nightly section
- #193 dropped stale android-not-present TODOs from cd.yml + release.yml
- #194 archived docs/gap-analysis/PLAN.md (all tracks landed)

Real bug fix:
- #198 mounted ErrorModal + ReactErrorBoundary + LiveRegion in App
  (they were built but never mounted — every \`reportError\` call was
  silently swallowed, violating the "hard-fail, no fallbacks" rule)

Dead code deletion (~3000 LOC total):
- #195 3 orphan hooks (useResponsiveFov / useResponsiveCockpitScale / useDeviceDetection)
- #196 orphan WorldScroller (replaced by TrackScroller)
- #197 5 orphan cockpit modules (CameraRig/CockpitCamera/CockpitDamageFX/CockpitSteeringWheel/PlayerCar)
- #199 5 more orphans (SkyDome/Lighting/CockpitHood/useCockpitAnimation/useShake)
- #200 orphan useObstacleFrame + collisionSystem + tests
- #201 dropped stale re-exports from ObstacleSystem
- #202 orphan damageLevel + difficultyTelemetry
- #203 orphan PhotoMode UI (never mounted)
- #204 7 cascading orphans (AchievementToast/ZoneBanner/useComboMultiplier/usePrefersReducedMotion/critterPool/plungeMotion/+tests)
- #205 orphan toastTimings

**Track C (orphan code wiring)** is done — see table above.

Test count: 815 passing (down from 898 — all removed tests were for deleted orphans, live coverage intact).

---

## Known issues

- iPhone 14 Pro + mid-tier Android FPS: unverified (no real-device baseline)
- release-please GitHub Actions PR permission not yet enabled in repo settings (requires manual repo settings change — see DEPLOYMENT.md)
- CI E2E job was stalling 50+ min because `visual-regression.spec.ts` pinned baselines were hand-drawn landing art (100% pixel mismatch → 30s timeout → retries → browser crash cascade). Fixed across PRs #175 → #188; E2E now completes in ~3 min.
- Android Maestro CI emulator step is flaky (ADB daemon connect failures). Scoped `continue-on-error: true` on that step only (APK build itself blocks). Non-blocking by design.
- CI swiftshader still emits `GL Driver Message: GPU stall due to ReadPixels` even after #187's `preserveDrawingBuffer: false` fix. Candidate remaining sources: `@react-three/drei`'s `MeshReflectorMaterial` (rear-view mirror, resolution=512), `EffectComposer`'s bloom `mipmapBlur`. Effect: 3-5× game-time dilation on CI (distance takes ~60s wall to reach 3m). Doesn't affect real devices or the merge gate; deep nightly `seed-playthroughs` hits the 45-min cap as a result and gets cancelled.

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
