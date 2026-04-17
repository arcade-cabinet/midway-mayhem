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

## Rationale

- **Why scroll world, not move car?** Eliminates the entire "camera chases moving vehicle" bug class (sail-glitch, pillar-clipping). Proven in marmalade-drops pinball; same principle.
- **Why bake the kit?** Runtime retex is nondeterministic (depends on load order, material name collisions across GLBs). Baked GLBs are inspectable and identical everywhere.
- **Why hard-fail?** Silent fallbacks hid the HDRI base-URL bug for 30 minutes in this very session. Visible errors = debuggable errors.
- **Why HDRI for everything?** One asset does lighting + background + reflections. No extra skybox mesh, no separate IBL probe.
