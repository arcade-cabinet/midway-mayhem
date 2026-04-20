---
title: Architecture
updated: 2026-04-20
status: current
domain: technical
---

# Architecture

## System overview

Midway Mayhem is an R3F arcade driver. The top-level boundaries are:

```
Input  →  ECS world (koota)  →  R3F render tree  →  HUD overlay
                               ↓
                        Persistence layer (SQLite / OPFS)
```

Audio and the persistence layer are side-effectful but unidirectional: they read game state but do not write back into the ECS world.

---

## Module boundaries

| Directory | Responsibility | Key files |
|-----------|---------------|-----------|
| `src/app/` | Root composition, error boundary, suspense | `App.tsx`, `GameLoop.tsx`, `main.tsx` |
| `src/ecs/` | koota world definition, all traits, ECS systems | `world.ts`, `traits.ts`, `systems/` |
| `src/game/` | Pure logic (no JSX): run plan, game state, obstacles, collision, scoring, combo, trick, damage, ghost, replay | `gameState.ts`, `runPlan.ts`, `comboSystem.ts`, `trickSystem.ts`, `replayRecorder.ts`, `obstacles/` |
| `src/render/` | R3F components that query traits, never own state | `cockpit/`, `track/`, `obstacles/`, `env/` |
| `src/audio/` | Tone.js buses, conductor phrase grammar, SF2 sampler, SFX recipes | `audioBus.ts`, `conductor.ts`, `sf2.ts`, `sfx.ts`, `buses.ts` |
| `src/track/` | Procedural track geometry, zone system, track sampler | `trackGenerator.ts`, `zoneSystem.ts`, `dailyRoute.ts` |
| `src/persistence/` | drizzle-orm schema, profile, replay, lifetime stats, achievements, preferences, tutorial | `db.ts`, `schema.ts`, `profile.ts`, `replay.ts` |
| `src/config/` | tunables.json, archetype JSON files, zod schemas | `tunables.json`, `archetypes/*.json` |
| `src/design/` | Design tokens, typography constants, shared UI components | `tokens.ts`, `typography.ts`, `components/` |
| `src/ui/` | React screen-level UI: title screen, HUD panels, game-over, achievement toasts | `TitleScreen.tsx`, `hud/`, `panels/`, `title/` |
| `src/hooks/` | Form-factor hooks, device detection, responsive FOV, loadout, input helpers | `useFormFactor.ts`, `useResponsiveFov.ts`, `useDeviceDetection.ts` |
| `src/input/` | Touch controls, keyboard bindings, haptics bridge | `TouchControls.tsx`, `useKeyboard.ts`, `haptics.ts` |
| `src/storage/` | Lightweight KV storage wrapper for preferences and session data | `scores.ts` |
| `src/utils/` | PRNG, math utilities, constants | `rng.ts`, `math.ts`, `constants.ts` |
| `src/test/` | Vitest scene harness, browser test setup | `setup.ts` |

---

## koota ECS world

One koota world (`src/ecs/world.ts`) is the entire game state boundary. Traits defined in `src/ecs/traits.ts` map to every live entity: player car, obstacles, pickups, ghost car, critters, zone state.

ECS systems in `src/ecs/systems/` run per-frame:
- `playerMotion.ts` — integrate steering → lateral position
- `track.ts` — advance player along spline, detect zone transitions
- `collisionSystem.ts` — sphere-vs-sphere checks, dispatch crash/pickup events
- `gameOver.ts` — check win/death conditions

Zustand (`gameState.ts`) provides a reactive session/player shim (`useGameStore`) consumed by HUD components. The shim reads from ECS traits — it does not own canonical state.

---

## R3F scene tree

```
<App>                         App.tsx — suspense + error boundary
  <Canvas>
    <GameLoop>                GameLoop.tsx — useFrame ECS tick
    <CameraRig>               render/cockpit/CameraRig.tsx — parented to cockpit group
      <Cockpit>               render/cockpit/Cockpit.tsx — polka-dot body, hood, wheel, gauges
        <CockpitHood>
        <CockpitSteeringWheel>
        <CockpitDamageFX>
        <DiegeticHUD>         in-world speed/sanity gauges
    <WorldScroller>           render/track/WorldScroller.tsx — translates world past fixed cockpit
      <Track>                 render/track/Track.tsx — procedural geometry (live, tested)
      <TrackContent>          render/track/TrackSystem.tsx — obstacles + pickups
      <BalloonLayer>
      <FireHoopGate>
      <MirrorLayer>
      <RaidLayer>
      <GhostCar>              replay ghost overlay
    <Environment>             render/env/Environment.tsx — HDRI dome + zone lighting
    <ZoneBanners>             render/ZoneBanners.tsx
    <PostFX>                  render/PostFX.tsx — Bloom, Vignette, CA, Noise
  </Canvas>
  <HUD>                       src/ui/hud/ — React DOM overlay
  <ErrorModal>                src/game/errorBus.ts subscriber
  <AchievementToasts>
</App>
```

The camera is a child of `<Cockpit>`. When the cockpit group moves (banking, steering), the camera moves with it. This is the architectural fix for the "sail glitch" from the HTML POC.

---

## Run elevation profile

The Midway is **a coiled descent through the big-top.** The track is generated from `src/config/archetypes/track-pieces.json` archetype set, but the per-archetype `deltaPitch` values + `weight` distribution are tuned so the **cumulative Y across the run is monotonically non-increasing across the descent zones.**

### Target shape

```
Cumulative Y (m)
  +5 ┤●─╮
   0 ┤  ╰●──╮
  -5 ┤      ╰●──●──╮
 -15 ┤              ╰●──●──╮
 -25 ┤                      ╰●──●──╮
 -35 ┤                              ╰●──●  finish line on dome floor
      └──────┬───────┬───────┬───────┬─────
       zone1   zone2   zone3   zone4
       intro   tilt    descend coil
       (flat) (mild)  (steep)  (steep)
```

- **Zone 1 (Midway Strip, 0-450m)** — start at +30m Y on a wire-hung gondola; track itself stays nearly flat (~5m drop). Tutorial space; player learns to steer before the dive begins.
- **Zone 2 (Balloon Alley, 450-900m)** — gentle 10-15m descent. `dip` weight bumped, `climb` weight zeroed.
- **Zone 3 (Ring of Fire, 900-1350m)** — steep 25-35m descent with `plunge` pieces. Audience seats flank both sides; player feels the FALL.
- **Zone 4 (Funhouse Frenzy, 1350-1800m)** — final coil down to the floor. `coil-down` archetypes (curved + dipping). Run ends at Y ≈ 0 on a black-and-white checker race-line.

### Constraints

- Cumulative pitch is clamped to `±0.06` rad (PITCH_MAX / PITCH_MIN in `src/ecs/systems/track.ts`) — about 3.4°. The clamp is deliberately tight: a 22m piece at the floor of the band drops ~1.3m, so 60 descent-phase pieces accumulate to a coil-readable total without ever pinning the integrator into a free-fall artifact.
- The generator falls back to `straight` when an archetype would breach the band, so the descent doesn't compound into invalid orientations.
- Per-zone weight multipliers (`ZONE_WEIGHT_MULTIPLIERS` in `src/ecs/systems/track.ts`) layer on top of the archetype JSON weights to bias archetype selection by zone — zone 1 disables `dip`/`plunge`/`climb` entirely, zones 2-4 progressively increase descent share while keeping `straight` dominant so the descent stays unpinned.
- Total descent target: **25-70m** across `runLength=80` pieces. The canonical seed (42) lands at ~37m with zone-1 flat, zone 2 ~2m, zones 3-4 ~18m each.

### Test gate

`src/track/__tests__/elevationProfile.test.ts` calls `generateTrack(seed)`, samples cumulative Y at every piece boundary, and asserts:
1. The last piece's `endPose.y` is at least 25m below the first piece's `startPose.y`.
2. Across pieces 32-79 (last 60% of the run), the cumulative Y is monotonically non-increasing within a small per-piece tolerance (some `slight-left`/`slight-right` micro-bumps are allowed).

Visual verification: `pnpm test:browser TrackPackage` re-renders `src/track/__baselines__/track-package/side.png`, where the descent should be obvious as a sustained downward Y delta from screen-top to screen-bottom.

---

## Audio bus layer

Three buses managed by `src/audio/buses.ts`:
- **Music bus** — `conductor.ts` phrase grammar driving Tone.js + SF2 sampler
- **SFX bus** — engine hum, honk, crash, pickup (procedural Tone.js)
- **Honk bus** — dedicated channel so honk always cuts through without ducking

`audioBus.ts` is the public API. `conductor.ts` sequences CircusConductor phrase patterns (zone-aware), sidechain-ducking the music bus during honk.

---

## Persistence layer

| Target | Stack |
|--------|-------|
| Native (iOS + Android) | `@capacitor-community/sqlite` + drizzle-orm ORM |
| Web (debug) | `sql.js` (WASM) + OPFS virtual filesystem |

Both paths share identical drizzle schema in `src/persistence/schema.ts`. `src/persistence/dbDrivers.ts` conditionally imports the correct driver based on `Capacitor.isNativePlatform()`.

Tables: `profile`, `run`, `replay`, `lifetime_stats`, `achievements`, `preferences`, `tutorial_progress`.

On run end, `src/game/runEndPersistence.ts` collects final state from the ECS world and writes to persistence in a single transaction.

---

## Capacitor bridge

`src/hooks/useDeviceDetection.ts` calls Capacitor `Device` + `ScreenOrientation` APIs to determine form factor (phone/tablet/foldable/desktop). On failure it throws (no silent fallback); `<ErrorModal>` surfaces it.

Haptics: `src/input/haptics.ts` wraps `@capacitor/haptics` + falls back to `navigator.vibrate` on mobile web. No silent suppression — if both are unavailable the call is a no-op logged to `errorBus`.

Status bar + safe-area insets are read once at boot from `@capacitor/status-bar` and surfaced as CSS custom properties for HUD layout.

---

## Data flow: input → ECS → render → HUD → persistence

```
1. input/TouchControls.tsx or useKeyboard.ts
     → writes steer delta to ECS player trait each frame

2. ECS systems (src/ecs/systems/) tick every useFrame:
     playerMotion  →  updates lateral position, speed, banking angle
     track         →  advances distance, triggers zone change
     collision     →  emits crash/pickup/trick events

3. render/ components query ECS traits via koota hooks
     (no local state in render components — pure query + display)

4. HUD panels (src/ui/hud/) subscribe to useGameStore (zustand shim)
     → reactive speed, sanity, crowd-reaction, zone, crash count

5. On runEnd:
     runEndPersistence.ts reads final ECS snapshot
     → writes profile + run + lifetime_stats + achievements in one transaction
```

---

## Build output anatomy

### Web (debug target)

```
dist/
  index.html
  assets/          # Vite-chunked JS + CSS
  hdri/            # circus_arena_2k.hdr
  textures/        # PBR maps
  fonts/           # Bangers.woff2, Rajdhani.woff2
  sql-wasm.wasm    # copied by vite plugin at build time
```

### Native (Capacitor iOS + Android)

`pnpm build:native` sets `base='./'`, writes `dist/`, then `cap sync` copies dist into `ios/App/public/` and `android/app/src/main/assets/public/`. SQLite is backed by the native filesystem, not WASM.

---

## Key constraints

1. `.ts` = logic, `.tsx` = rendering, `.json` = data. No magic numbers in `.ts` — all tunables live in `src/config/tunables.json`.
2. One koota world is the entire state boundary. No second store for entity data.
3. No GLB road pieces. Track geometry is generated procedurally from JSON archetypes.
4. Hard-fail everywhere. Every throw paths to `errorBus.reportError`. No silent catches.
5. Test-gated. Each subsystem has browser screenshot tests on the real Chrome GPU.
