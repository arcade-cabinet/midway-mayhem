---
title: Reference → v2 Porting Map
updated: 2026-04-17
status: current
domain: technical
---

# Reference → v2 Porting Map

**Goal.** Move every module in `reference/src/` back into `src/` under a cleaner structure, fix imports, and rewire. Then delete `reference/`.

**Architecture rules (re-affirmed from CLAUDE.md):**
1. `.ts` = logic, `.tsx` = rendering, `.json` = data.
2. One koota world — zustand stores become traits.
3. Hard-fail, no fallbacks — errors route through `errorBus` → `ErrorModal`.
4. No keyboard-only inputs. Anything that "holds space" gets a mobile-first replacement.

---

## Target folder structure

```
src/
  app/              App composition only
  audio/            audioBus, buses, conductor, honk, sf2, sfx, tireSqueal, useArcadeAudio
  config/           schemas + loader + defaults + shopCatalog (existing tunables.json stays)
  design/           tokens, typography, components/ (Panel, BrandButton, Banner, Dialog, GaugeBar, HUDFrame, Stat)
  ecs/
    traits.ts       koota traits (one file ok, split if >300 LOC)
    world.ts        world singleton
    systems/        per-tick ECS update systems
  game/             pure logic: PRNG buses, difficulty, combo, trick, deviation, damage, achievement bus,
                    runPlan, runRngBus, runEndPersistence, gameState*, replayRecorder, optimalPath,
                    errorBus, hapticsBus, diagnosticsBus, governor/
  hooks/            useFormFactor, useDeviceDetection, useResponsive*, usePrefersReducedMotion,
                    useKeyboardControls (desktop only), useTouchGestures, useShake, useSteering, useLoadout
  input/            TouchControls (existing), useKeyboard bridge (existing)
  persistence/      db, dbDrivers, schema, profile, preferences, settings, tutorial, lifetimeStats,
                    achievements, achievementCatalog, replay   [REPLACES src/storage/]
  render/
    Track.tsx       (existing)
    TrackContent.tsx
    cockpit/        Cockpit, CockpitHood, CockpitSteeringWheel, CockpitDamageFX, SpeedFX, ExplosionFX,
                    RacingLineGhost, PlayerCar, CameraRig, CockpitCamera, useCockpitAnimation, plungeMotion
    obstacles/      BalloonLayer, BarkerCrowd, FireHoopGate, MirrorLayer, RaidLayer, ObstacleSystem,
                    PickupSystem, GhostCar
    env/            BigTopEnvironment, Lighting, SkyDome (moved out of game/)
    PostFX.tsx
    SpeedLines.tsx
    BoostRush.tsx
    ZoneBanners.tsx
  track/            trackComposer, trackGenerator, dailyRoute, zoneSystem
  ui/
    title/          TitleScreen, TitleCompactLayout, TitleHeroLayout, NewRunModal, SeedPhraseField,
                    PermadeathToggle, DifficultyTile
    panels/         AchievementsPanel, SettingsPanel, HowToPlayPanel, CreditsPanel, StatsPanel,
                    TicketShop, ShopRow, Leaderboard, PhotoMode
    hud/            HUD, AchievementToast, ZoneBanner, RaidTelegraphBanner, TrickOverlay,
                    RacingLineMeter, GameOverOverlay, ErrorModal, LiveRegion, ReactErrorBoundary,
                    useComboMultiplier
  utils/            rng (now dual-channel), seedPhrase, math, constants, proceduralTextures
  assets/           manifest, preloader
  test/             browser harness + setup (existing)
```

---

## Module-by-module mapping

Legend: **P** = port as-is · **R** = restructure / split · **M** = merge with existing v2 · **D** = drop (duplicate or obsolete) · **T** = test file, ports with its source

### `reference/src/utils/`

| reference | → | target | action |
|---|---|---|---|
| rng.ts | → | src/utils/rng.ts | R (replace single Rng class with dual-channel createRunRng; keep rejection sampling) |
| seedPhrase.ts | → | src/utils/seedPhrase.ts | P |
| math.ts | → | src/utils/math.ts | P |
| constants.ts | → | src/utils/constants.ts | P |
| proceduralTextures.ts | → | src/utils/proceduralTextures.ts | P |
| __tests__/rng.test.ts | → | src/utils/__tests__/rng.test.ts | T |
| __tests__/runRng.test.ts | → | src/utils/__tests__/runRng.test.ts | T |
| __tests__/seedPhrase.test.ts | → | src/utils/__tests__/seedPhrase.test.ts | T |

### `reference/src/design/`

All **P** — drop unchanged into `src/design/`.

### `reference/src/persistence/`

All **R** — move `src/storage/` contents into `src/persistence/` first, then port everything and delete `src/storage/`.

### `reference/src/hooks/`

All **P** to `src/hooks/` except:
- `useKeyboardControls.ts` — P **but** never the sole input path; all actions must also be available on touch.
- `useTouchGestures.ts` — primary input on mobile.

### `reference/src/audio/`

All **R** — port to `src/audio/`, merge existing `useArcadeAudio.ts` as a thin facade over the new conductor.

### `reference/src/config/`

All **P** to `src/config/`, but keep the existing `src/config/tunables.json` + archetypes JSON; the reference `defaults.ts` + schema zod validators wrap them.

### `reference/src/game/`

Pure logic (`.ts`) → `src/game/`:
- achievementBus, comboSystem, damageLevel, deviationWindow, diagnosticsBus, difficulty, difficultyTelemetry,
  errorBus, gameState, gameStateCombat, gameStateTick, hapticsBus, optimalPath, optimalPathScripts,
  replayRecorder, runEndPersistence, runPlan, runRngBus, trickSystem, useGameSystems
- governor/Governor.tsx, governor/GovernorDriver.ts → `src/game/governor/` (governor runs the autoplay harness)

Render (`.tsx`) → `src/render/env/` and `src/game/`:
- Environment.tsx, Lighting.tsx, SkyDome.tsx, PostFX.tsx → `src/render/env/` (merge with existing Environment.tsx/PostFX.tsx)
- Game.tsx, GameLoop.tsx → `src/app/` (merge with existing App.tsx logic)
- debugCapture.tsx → `src/game/debugCapture.tsx`

### `reference/src/cockpit/`

All → `src/render/cockpit/` (merge with existing `src/render/cockpit/Cockpit.tsx`). Split:
- logic files (`plungeMotion.ts`, `useCockpitAnimation.ts`) stay `.ts`
- render tsx files go alongside the existing Cockpit.tsx

### `reference/src/track/`

- `trackComposer.ts`, `trackGenerator.ts`, `zoneSystem.ts`, `dailyRoute.ts` → `src/track/`
- `TrackSystem.tsx`, `WorldScroller.tsx`, `StartPlatform.tsx`, `FinishBanner.tsx` → `src/render/track/`

Merge with existing:
- `src/ecs/systems/track.ts` (seedTrack logic)
- `src/ecs/systems/trackSampler.ts` (pose sampling)
- `src/render/Track.tsx` (3D renderer)

The reference `trackGenerator` + `trackComposer` is more sophisticated; port on top of the clean segmenting we have.

### `reference/src/obstacles/`

Split by kind:
- logic → `src/game/obstacles/` (balloonSpawner, obstacleSpawner, collisionSystem, critterPool, raidDirector, mirrorDuplicator, trackToWorld, useObstacleFrame)
- render → `src/render/obstacles/` (BalloonLayer, BarkerCrowd, FireHoopGate, MirrorLayer, RaidLayer, ObstacleSystem, PickupSystem, GhostCar)

Wire logic to `rng.events` channel. Replace the existing `src/render/GhostCar.tsx` with the reference version (more complete).

### `reference/src/hud/`

Split by role:
- title-screen surfaces → `src/ui/title/` (TitleScreen, TitleCompactLayout, TitleHeroLayout, NewRunModal, SeedPhraseField, PermadeathToggle, DifficultyTile)
- panels (full-screen overlays) → `src/ui/panels/` (AchievementsPanel, SettingsPanel, HowToPlayPanel, CreditsPanel, StatsPanel, TicketShop, ShopRow, Leaderboard, PhotoMode)
- in-run surfaces → `src/ui/hud/` (HUD, AchievementToast, ZoneBanner, RaidTelegraphBanner, TrickOverlay, RacingLineMeter, GameOverOverlay, ErrorModal, LiveRegion, ReactErrorBoundary, useComboMultiplier)

Merge existing `src/ui/AchievementToasts.tsx` + `src/ui/GameOverOverlay.tsx` with the reference versions (reference is more complete).

### `reference/src/assets/`

`manifest.ts`, `preloader.ts` → `src/assets/`. P.

### `reference/src/app/`

`App.tsx` → merge into existing `src/app/App.tsx`. Use reference App as the target structure; keep v2 seeding block intact.

### `reference/src/main.tsx`

Already replicated in v2; drop.

### `reference/src/__tests__/`

Global browser-scene harness tests. Move to `src/test/` (alongside existing scene harness). Port.

---

## Execution order

Built to respect dependencies — later tasks import from earlier ones.

1. **Utils** (rng, seedPhrase, math, constants, proceduralTextures)
2. **Design system** (tokens, typography, components)
3. **Persistence** (db → profile/settings/etc → achievements)
4. **Hooks** (form factor, responsive, touch, keyboard, shake, steering)
5. **Config** (schemas, loader, shopCatalog)
6. **Game logic buses** (errorBus, achievementBus, hapticsBus, diagnosticsBus, runRngBus)
7. **Game systems** (difficulty, combo, trick, deviation, damage, replayRecorder, optimalPath, runPlan, runEndPersistence)
8. **Audio** (audioBus, buses, conductor, honk, sf2, sfx, tireSqueal)
9. **Track logic** (trackComposer, trackGenerator, zoneSystem, dailyRoute) — merge with existing ECS track systems
10. **Obstacle logic** (spawners, collision, raidDirector, critterPool, mirrorDuplicator)
11. **Render — env** (Environment, Lighting, SkyDome, PostFX)
12. **Render — cockpit** (CockpitDamageFX, CockpitSteeringWheel, ExplosionFX, SpeedFX, RacingLineGhost, PlayerCar, CameraRig)
13. **Render — track** (TrackSystem, WorldScroller, StartPlatform, FinishBanner)
14. **Render — obstacles** (BalloonLayer, BarkerCrowd, FireHoopGate, MirrorLayer, RaidLayer, ObstacleSystem, PickupSystem, GhostCar)
15. **UI — hud** (HUD, AchievementToast, ZoneBanner, RaidTelegraphBanner, TrickOverlay, RacingLineMeter, GameOverOverlay, ErrorModal, LiveRegion, ReactErrorBoundary, useComboMultiplier)
16. **UI — panels** (AchievementsPanel, SettingsPanel, HowToPlayPanel, CreditsPanel, StatsPanel, TicketShop, ShopRow, Leaderboard, PhotoMode)
17. **UI — title** (TitleScreen, TitleCompactLayout, TitleHeroLayout, NewRunModal, SeedPhraseField, PermadeathToggle, DifficultyTile)
18. **App.tsx** rewire — bring in Game/GameLoop composition, replace the simple TitleScreen with the full one, wire governor for `?autoplay=1`
19. **Delete reference/** after every file accounted for

---

## Per-step gate

After each step:
- `pnpm typecheck` clean
- `pnpm lint` clean
- ported `__tests__/` from the same reference dir pass
- commit with scope, push, open/update PR

Mobile-first check each step: any input that requires keyboard-only (no touch equivalent) is a **bug**, fix before moving on.
