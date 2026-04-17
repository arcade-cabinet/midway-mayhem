---
title: Architecture
updated: 2026-04-16
status: current
domain: technical
---

# Architecture

## Rendering pipeline

```
<App>
  <ReactErrorBoundary context="app-root">
    <Suspense>
      {scene === 'title' && <TitleScreen />}
      {scene === 'play'  && <Game />}
    </Suspense>
  </ReactErrorBoundary>
  <ErrorModal />
</App>

<Game>
  <HUD />                     — DOM overlay
  <ZoneBanner />              — DOM overlay
  <Canvas>                    — r3f root
    <ReactErrorBoundary context="canvas-root">
      <Suspense>
        <Environment files="circus_arena.hdr" background />
        <ambientLight />
        <GameLoop />          — drives store tick
        <WorldScroller>       — translates world past fixed cockpit
          <TrackSystem />     — drei.useGLTF per baked Kenney piece
          <ObstacleSystem />  — instanced meshes fed by ObstacleSpawner
          <PickupSystem />    — instanced meshes, world-mapped via trackToWorld
          <GhostCar />        — translucent replay ghost (daily route only)
          <RacingLineGhost /> — wireframe optimal-line guide, 12m lookahead
        </WorldScroller>
        <Cockpit>             — world-origin, hand-authored procedural
          <CockpitCamera />   — PerspectiveCamera makeDefault, inside cockpit body
        </Cockpit>
        <Governor />          — ?governor=1, drives via setSteer
        <PostFX />             — Bloom + ChromaticAberration + Noise + Vignette
      </Suspense>
    </ReactErrorBoundary>
  </Canvas>
</Game>
```

## Core invariants

1. **Cockpit at world origin.** Never moves. World scrolls past.
2. **Camera is parented to the Cockpit group.** Banks + yaws + vibrates with it.
3. **Track is scrolled, not rebuilt per frame.** Composed once in `composeTrack(DEFAULT_TRACK)`, placed in `<WorldScroller>` which only translates.
4. **Player abstract position is (distance, lateral).** All world placement (obstacles, pickups, camera reaction) derives from these via `trackToWorld(composition, d, lat)`.

## Data flow

```
input (pointer / touch / governor)
    ↓  useSteering  /  Governor.useFrame
gameState.setSteer(normalized -1..1)
    ↓  GameLoop.useFrame
gameState.tick(dt):
    integrate speed → distance
    damp lateral from steer
    derive zone from distance
    derive hype from speed
    regen sanity
    ↓  subscribers
HUD panels / ZoneBanner / Cockpit animators / WorldScroller position
```

## Collision loop

`ObstacleSystem` runs a per-frame pass:
1. `spawner.update(s.distance, s.currentZone)` — spawn ahead, recycle behind
2. Iterate obstacles → compute world XYZ via `trackToWorld` → write to InstancedMesh matrices
3. Collision: distance window around player, lane-offset vs lateral, apply crash or pickup
4. `reportCounts(obstacles, pickups, drawCalls)` → diagnostics bus

## Asset preload

```
App.useEffect on mount:
  installGlobalErrorHandlers()
  installDiagnosticsBus()
  preloadAllAssets()
    → fetch HEAD on every ASSET_MANIFEST entry
    → reject-all on any 404 with path-specific message
  .then(setScene('title'|'play'))
  .catch(reportError(err, 'preloadAllAssets'))
```

`Environment` + `useGLTF` then load the actual bytes inside `<Canvas><Suspense>`. Preload is just an existence probe.

## Error propagation

```
throw / reject anywhere
    ↓
errorBus.reportError(err, context)
    ↓
state.errors = [...state.errors, gameErr]   // new array → React re-renders
state.halted = true                          // permanent (reload to reset)
listeners.forEach(fn => fn(state.errors))
    ↓
<ErrorModal> subscribed → setErrors → renders modal
```

## Build output

| Chunk | Contains | Load |
|---|---|---|
| index.js | App shell + HUD + TitleScreen + game logic | on boot |
| (inline, future) react-vendor | react, react-dom, react-router | on boot |
| (inline, future) three-vendor | three, r3f, drei, postprocessing | on /game |
| (inline, future) audio-vendor | tone | on user gesture |
| (inline, future) db-vendor | sql.js, drizzle, capacitor-sqlite | on first save |

Chunk-splitting plan mirrors grailguard's `vite.config.ts` — to be applied when bundle grows.

## Platform targets

- **Web:** Vite build → GH Pages at `/midway-mayhem/`.
- **Android:** `pnpm native:android:debug` → `android/app/build/outputs/apk/debug/`.
- **iOS:** `pnpm native:ios:build` → xcodebuild sim build.

Capacitor switches Vite base via `CAPACITOR=true` env var.

## Diagnostics surface

```
window.__mm.diag() → DiagnosticsDump
window.__mmSpawner → ObstacleSpawner  (governor reads)
window.__mmGovernor → GovernorDriver  (governor writes steer)
window.__mmHonk() → fires audioBus.playHonk()
```

Only installed in dev or `?diag=1` / `?governor=1`.

## Racing-line scoring pipeline

```
startRun(plan)
    ↓  solveOptimalPath(plan)          — O(n*lanes) forward sweep, one-shot
state.optimalPath: OptimalPath         — stored for the entire run

gameState.tick(dt, now)
    ↓  updateDeviationWindow(d, lateral, optPath)
         — adds (d, lateral) sample, evicts entries older than 200 m
         — computes mean-squared deviation over the window
    ↓  raw = 1 − msd / (3m²)           — normalise: 0 msd→1.0, ≥9m²→0.0
    ↓  EMA(0.05)                        — smooth so readout is not jittery
state.cleanliness: number [0..1]

applyPickup(kind)
    ↓  cleanBonus = 1 + cleanliness × 0.5
    ↓  crowdGain × cleanBonus          — stacks on top of combo chain mult
state.crowdReaction += gain

<RacingLineMeter>
    ↓  reads state.cleanliness
    — color gradient: red@0% → yellow@50% → green@100%
    — percentage label + thin fill bar
```

The deviation window is a module-level array (not in Zustand state) to avoid
re-rendering overhead. It is reset on `startRun` and `resetGameState`.

## Scripted outcomes & determinism

`src/game/optimalPath.ts` exposes two entry points for deterministic run control:

### Solver (`solveOptimalPath`)

A forward sweep over the run plan produces an `OptimalPath` — a sorted list of `(d, lane)` waypoints that minimise obstacle hits while collecting high-value pickups. O(n × LANE_COUNT) in plan size. Used at run-start to power:
- The racing-line deviation score (`scoreDeviation`)
- The `finish-clean` test script

### Test factory (`scriptForOutcome / scriptForSeed`)

```
buildRunPlan(seed) → RunPlan
    ↓  scriptForOutcome(plan, outcome)
ScriptedInput[]   — sorted by dTrigger ascending

ScriptedInput { dTrigger: number; key: 'ArrowLeft'|'ArrowRight'; type: 'keydown'|'keyup' }
```

The script is **distance-triggered**, not time-triggered, making it robust to frame-rate jitter and turbo playback. Four outcomes are supported:

| Outcome | Strategy |
|---|---|
| `finish-clean` | Lane path from `solveOptimalPath`; every keydown has a matching keyup |
| `collide-first` | Stay in / steer into the first obstacle's lane |
| `plunge-off-ramp` | Hard-right from 20m before first `rampLong` piece; `setCurrentPieceKind` simulation needed in test |
| `survive-30s` | Same as `finish-clean` but script filtered to `dTrigger < 30s × 30m/s` |

`scriptForSeed(seed, outcome)` is a convenience wrapper that calls `buildRunPlan + scriptForOutcome` in one call.

### Turbo playback in tests

The browser test suite does NOT mount the full game. It drives the state machine directly:

1. `startRun({seed})` — seeds plan + store
2. `setDropProgress(1)` — skip drop-in animation
3. Turbo loop — `setInterval` that runs 20 simulation steps of `STEP_DT=0.05s` per 16ms wall-clock interval, using a simulated clock so `plungeStartedAt` / boost timers work correctly
4. Script player — called synchronously inside each step so no event is missed
5. Stop condition poll — resolves when distance threshold or plunge/crash state met

This pattern advances a 4000m run in ~2s of real time.

## Rationale

- **Why scroll world, not move car?** Eliminates the entire "camera chases moving vehicle" bug class (sail-glitch, pillar-clipping). Proven in marmalade-drops pinball; same principle.
- **Why bake the kit?** Runtime retex is nondeterministic (depends on load order, material name collisions across GLBs). Baked GLBs are inspectable and identical everywhere.
- **Why hard-fail?** Silent fallbacks hid the HDRI base-URL bug for 30 minutes in this very session. Visible errors = debuggable errors.
- **Why HDRI for everything?** One asset does lighting + background + reflections. No extra skybox mesh, no separate IBL probe.
