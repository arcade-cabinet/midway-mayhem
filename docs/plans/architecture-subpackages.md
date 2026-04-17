---
title: Architecture — In-Source Subpackages
updated: 2026-04-17
status: draft
domain: technical
---

# Architecture: In-Source Subpackages

> Plan only. Do not start implementing until this doc is approved and the migration steps are scheduled.

## 1. Current Pain Points

`src/` is a single flat namespace. `tsconfig.json` provides `@/*` → `./src/*` but nothing enforces feature boundaries — any file can import any other with a relative path, and those paths are already getting long (`../../systems/audioBus`).

Specific files at risk as the game grows:

| File | Risk |
|------|------|
| `systems/gameState.ts` | 180 LOC today; every new game mechanic (leaderboard, power-ups, run history) lands here by default. Already has 3+ magic numbers duplicating `constants.ts`. |
| `components/Cockpit.tsx` | 343 LOC — already over the 300-LOC limit. Mixes Three.js geometry, animation logic, camera choreography, and drop-in sequencing. No clear seam to test in isolation. |
| `systems/obstacleSpawner.ts` | `ZONE_WEIGHTS` inline table will balloon with every new zone or obstacle type. No schema validation on the weights. |
| `systems/audioBus.ts` | Thin orchestrator that reaches into `audio/buses.ts`, `audio/conductor.ts`, `audio/sfx.ts` — already three files with no public barrel. Adding spatial audio or multiple engines means the surface grows uncontrolled. |
| `utils/constants.ts` | Mix of physical tunables (`SPEED`, `STEER`, `HONK`), world data (`ZONES`), brand colors (`COLORS`), and type-only definitions. Hard to tell what is game-feel vs brand vs config. |
| `game/trackComposer.ts` | 238 LOC pure logic. A second track layout or procedural generation pass will push it past 300 LOC with no obvious split point unless the data (`PIECE_SPECS`, `DEFAULT_TRACK`) is separated from the algorithm. |

Cross-cutting concern: **there is no single load-time validation step** for the dozens of magic numbers scattered across `constants.ts`, `gameState.ts` (inline `CRUISE = 70`, `BOOST = 90`, `MEGA = 120`), `obstacleSpawner.ts` (inline spawn gap `18 + rng.range(0, 22)`), `audio/buses.ts` (inline dB levels), and `audio/conductor.ts` (inline BPM per zone). Changing game feel requires hunting across 6+ files.

## 2. Proposed Subpackage Layout

One `package.json`, one `pnpm install`. Each feature directory gains a public `src/<feature>/index.ts` barrel. `tsconfig.json` already has `@/*` → `./src/*`; we add explicit paths for each feature alias.

```text
src/
  config/          # tunables loader + zod schema
    index.ts       # barrel: export { loadConfig, tunables, TunablesSchema }
    schema.ts      # zod schema definition
    loader.ts      # fetch public/config/tunables.json, validate, freeze
  assets/          # (existing) manifest + preloader
    index.ts       # barrel: export { assetUrl, ASSET_MANIFEST, preloadAll }
  audio/           # all Tone.js — buses, conductor, sfx, honk
    index.ts       # barrel: export { audioBus, initAudioBusSafely, honk, onHonk }
    buses.ts
    conductor.ts
    sfx.ts
    honkBus.ts     # moved here from systems/
  cockpit/         # Cockpit.tsx, CockpitCamera.tsx, CameraRig.tsx, useShake
    index.ts       # barrel: export { Cockpit }
    Cockpit.tsx
    CockpitCamera.tsx
    CameraRig.tsx
    useShake.ts    # moved here from hooks/
  track/           # trackComposer, TrackSystem, WorldScroller, trackGenerator
    index.ts       # barrel: export { composeTrack, TrackSystem, WorldScroller, DEFAULT_TRACK, PIECE_SPECS }
    composer.ts    # renamed from game/trackComposer.ts
    generator.ts   # renamed from systems/trackGenerator.ts
    TrackSystem.tsx
    WorldScroller.tsx
  obstacles/       # spawner, collision, ObstacleSystem, PickupSystem
    index.ts       # barrel: export { ObstacleSpawner, detectCollisions, ObstacleSystem, PickupSystem }
    spawner.ts
    collision.ts
    ObstacleSystem.tsx
    PickupSystem.tsx
  game/            # gameState (zustand), GameLoop, zoneSystem, governor
    index.ts       # barrel: export { useGameStore, resetGameState, GameLoop, ZONE_THEMES, themeFor }
    gameState.ts
    GameLoop.tsx
    zoneSystem.ts
    governor/
  hud/             # HUD, ZoneBanner, TitleScreen, ErrorModal, design system
    index.ts       # barrel: export { HUD, ZoneBanner, TitleScreen, ErrorModal, ReactErrorBoundary }
    HUD.tsx
    ZoneBanner.tsx
    TitleScreen.tsx
    ErrorModal.tsx
    ReactErrorBoundary.tsx
    design/        # tokens, typography, components (stays co-located with HUD)
  hooks/           # remaining hooks: useSteering, useResponsiveFov, useFormFactor, useDeviceDetection
    index.ts       # barrel: export { useSteering, useResponsiveFov, useFormFactor, useDeviceDetection, useResponsiveCockpitScale }
  systems/         # thin residual: errorBus, diagnosticsBus, hapticsBus (cross-cutting singletons)
    index.ts       # barrel: export { reportError, errorBus, diagnosticsBus, hapticsBus }
  utils/           # math, rng, proceduralTextures; constants split (see §4)
    index.ts       # barrel: export { damp, laneCenterX, Rng, makePolkaDotTexture }
  app/             # App.tsx, main.tsx, global.css — app shell only
```

### Representative consumers

| Consumer | Before | After |
|----------|--------|-------|
| `Game.tsx` | `import { audioBus } from '../systems/audioBus'` | `import { audioBus } from '@/audio'` |
| `GameLoop.tsx` | `import { STEER } from '../utils/constants'` | `import { tunables } from '@/config'` |
| `ObstacleSystem.tsx` | `import { ObstacleSpawner } from '../systems/obstacleSpawner'` | `import { ObstacleSpawner } from '@/obstacles'` |
| `HUD.tsx` | `import { color } from '../design/tokens'` | `import { color } from '@/hud/design/tokens'` (or re-exported via `@/hud`) |

## 3. Barrel Pattern

Each feature directory exports exactly one public surface. Deep internal paths are package-private.

**`src/audio/index.ts`** (canonical example):
```ts
// Public surface of @/audio — import from here, not from deep paths
export { audioBus, initAudioBusSafely } from './audioBus';
export { honk, onHonk } from './honkBus';
// Internal: buses.ts, conductor.ts, sfx.ts are NOT re-exported
// They are consumed only by audioBus.ts inside this subpackage.
```

**Consumer** (`src/app/Game.tsx`):
```ts
// Good — uses the barrel
import { audioBus, honk } from '@/audio';

// Bad — deep path, bypasses barrel contract
import { audioBus } from '@/audio/audioBus';
```

**`tsconfig.json` paths** (additions):
```json
{
  "paths": {
    "@/*":          ["./src/*"],
    "@/audio":      ["./src/audio/index.ts"],
    "@/cockpit":    ["./src/cockpit/index.ts"],
    "@/track":      ["./src/track/index.ts"],
    "@/obstacles":  ["./src/obstacles/index.ts"],
    "@/game":       ["./src/game/index.ts"],
    "@/hud":        ["./src/hud/index.ts"],
    "@/config":     ["./src/config/index.ts"],
    "@/assets":     ["./src/assets/index.ts"],
    "@/hooks":      ["./src/hooks/index.ts"],
    "@/systems":    ["./src/systems/index.ts"],
    "@/utils":      ["./src/utils/index.ts"]
  }
}
```

A biome rule (`noRestrictedImports`) can enforce that `@/audio/buses` is never imported outside `src/audio/`. Add this to `biome.json` after barrels are in place.

## 4. Tunables JSON

### Magic numbers currently scattered in source

| Tunable | Current location | Value |
|---------|-----------------|-------|
| `speed.base` | `constants.ts` SPEED.BASE_MPS | 30 |
| `speed.cruise` | `constants.ts` + `gameState.ts` inline | 70 |
| `speed.boost` | `constants.ts` + `gameState.ts` inline | 90 |
| `speed.mega` | `constants.ts` + `gameState.ts` inline | 120 |
| `speed.crashDamping` | `constants.ts` | 0.55 |
| `speed.boostDuration` | `constants.ts` | 2.2s |
| `speed.megaDuration` | `constants.ts` | 3.5s |
| `steer.maxLateralMps` | `constants.ts` | 18 |
| `steer.returnTau` | `constants.ts` | 0.25 |
| `steer.wheelMaxDeg` | `constants.ts` | 35 |
| `steer.sensitivity` | `constants.ts` | 1.0 |
| `track.laneCount` | `constants.ts` | 3 |
| `track.laneWidth` | `constants.ts` | 3.3 |
| `track.chunkLength` | `constants.ts` | 40 |
| `track.lookaheadChunks` | `constants.ts` | 20 |
| `honk.scareRadius` | `constants.ts` | 22m |
| `honk.fleeLateral` | `constants.ts` | 6m |
| `honk.fleeDuration` | `constants.ts` | 0.7s |
| `honk.cooldown` | `constants.ts` | 0.35s |
| `obstacles.spawn.minGap` | `obstacleSpawner.ts` inline | 18 |
| `obstacles.spawn.jitter` | `obstacleSpawner.ts` inline | 22 |
| `obstacles.spawn.pickupMinGap` | `obstacleSpawner.ts` inline | 14 |
| `obstacles.spawn.pickupJitter` | `obstacleSpawner.ts` inline | 20 |
| `critters.pickupMegaThreshold` | `obstacleSpawner.ts` inline | 0.97 |
| `critters.pickupBoostThreshold` | `obstacleSpawner.ts` inline | 0.55 |
| `audio.buses.masterDb` | `buses.ts` | -6 |
| `audio.buses.musicDb` | `buses.ts` | -6 |
| `audio.buses.sfxDb` | `buses.ts` | -3 |
| `audio.buses.ambDb` | `buses.ts` | -14 |
| `audio.ducking.depthDb` | `buses.ts` | -8 |
| `audio.ducking.thresholdDb` | `buses.ts` | -24 |
| `scoring.ticketReward` | `gameState.ts` | 50 |
| `scoring.boostReward` | `gameState.ts` | 25 |
| `scoring.megaReward` | `gameState.ts` | 200 |
| `scoring.crashDamage` | `gameState.ts` | 10 |
| `scoring.heavyCrashDamage` | `gameState.ts` | 25 |
| `scoring.sanityRegen` | `gameState.ts` | 2/s |

### Schema (`src/config/schema.ts`)

```ts
import { z } from 'zod';

export const TunablesSchema = z.object({
  speed: z.object({
    base:          z.number().positive(),
    cruise:        z.number().positive(),
    boost:         z.number().positive(),
    mega:          z.number().positive(),
    crashDamping:  z.number().min(0).max(1),
    boostDuration: z.number().positive(),
    megaDuration:  z.number().positive(),
  }),
  steer: z.object({
    maxLateralMps: z.number().positive(),
    returnTau:     z.number().positive(),
    wheelMaxDeg:   z.number().positive(),
    sensitivity:   z.number().positive(),
  }),
  track: z.object({
    laneCount:      z.number().int().min(1),
    laneWidth:      z.number().positive(),
    chunkLength:    z.number().positive(),
    lookaheadChunks: z.number().int().positive(),
  }),
  honk: z.object({
    scareRadius:  z.number().positive(),
    fleeLateral:  z.number().positive(),
    fleeDuration: z.number().positive(),
    cooldown:     z.number().min(0),
  }),
  critters: z.object({
    pickupMegaThreshold:   z.number().min(0).max(1),
    pickupBoostThreshold:  z.number().min(0).max(1),
  }),
  obstacles: z.object({
    spawn: z.object({
      minGap:        z.number().positive(),
      jitter:        z.number().min(0),
      pickupMinGap:  z.number().positive(),
      pickupJitter:  z.number().min(0),
    }),
  }),
  zones: z.record(z.string(), z.object({
    root:  z.string(),
    tempo: z.number().positive(),
  })),
  audio: z.object({
    buses: z.object({
      masterDb: z.number(),
      musicDb:  z.number(),
      sfxDb:    z.number(),
      ambDb:    z.number(),
    }),
    ducking: z.object({
      depthDb:     z.number(),
      thresholdDb: z.number(),
    }),
  }),
  scoring: z.object({
    ticketReward:      z.number().int(),
    boostReward:       z.number().int(),
    megaReward:        z.number().int(),
    crashDamage:       z.number().positive(),
    heavyCrashDamage:  z.number().positive(),
    sanityRegen:       z.number().min(0),
  }),
});

export type Tunables = z.infer<typeof TunablesSchema>;
```

### Runtime loading (`src/config/loader.ts`)

```ts
import { TunablesSchema, type Tunables } from './schema';
import { reportError } from '@/systems';

let _tunables: Tunables | null = null;

/** Called once at boot, before React mounts. Hard-fails via errorBus on schema error. */
export async function loadConfig(): Promise<Tunables> {
  const url = new URLSearchParams(location.search).get('config')
    ?? `${import.meta.env.BASE_URL}config/tunables.json`;
  const raw = await fetch(url).then(r => r.json());
  const result = TunablesSchema.safeParse(raw);
  if (!result.success) {
    reportError(new Error(`tunables.json invalid: ${result.error.message}`), 'config/loader');
    throw result.error;
  }
  _tunables = Object.freeze(result.data);
  return _tunables;
}

export function tunables(): Tunables {
  if (!_tunables) throw new Error('[config] tunables not loaded — call loadConfig() first');
  return _tunables;
}
```

`public/config/tunables.json` is the default file. The `?config=https://...` URL flag lets designers override it at runtime for live tuning without a rebuild.

## 5. Migration Plan

Each step keeps all existing tests green. Steps are independent enough to be done in separate PRs.

| Step | Work | Effort |
|------|------|--------|
| 1. Add feature barrels | Create `src/<feature>/index.ts` for each subpackage. Re-export existing symbols, change nothing else. | 1h |
| 2. Add tsconfig paths | Add explicit aliases to `tsconfig.json` paths. Verify `pnpm typecheck` passes. | 20m |
| 3. Rewrite imports in `systems/` | Replace relative deep imports with `@/audio`, `@/game`, etc. across `systems/` files. | 1h |
| 4. Rewrite imports in `components/` | Same pass for all files under `components/`. Likely 15-20 files. | 1h |
| 5. Move `honkBus` into `audio/` | Move `systems/honkBus.ts` → `audio/honkBus.ts`. Update barrel. Single dependant: `Game.tsx`. | 30m |
| 6. Move `useShake` into `cockpit/` | Move `hooks/useShake.ts` → `cockpit/useShake.ts`. Update barrel. | 20m |
| 7. Rename `game/trackComposer.ts` → `track/composer.ts`, `systems/trackGenerator.ts` → `track/generator.ts` | Co-locate track logic. Update barrel and all importers. | 45m |
| 8. Introduce `@/config` with `loadConfig()` + zod schema | Wire `public/config/tunables.json`. Replace first consumer (`gameState.ts` speed constants). Tests must still pass. This is the **riskiest step** (see below). | 2-3h |
| 9. Migrate remaining magic numbers | Replace inline constants in `obstacleSpawner.ts`, `buses.ts`, `conductor.ts`, `gameState.ts` with `tunables()` calls. Do one file at a time. | 3h |
| 10. Enforce barrel-only imports | Add `noRestrictedImports` rule to `biome.json` blocking `@/<feature>/<deep>` from outside the feature directory. | 1h |

**Total estimated effort: ~11 hours across ~10 PRs.**

### Why step 8 is riskiest

`loadConfig()` is async and must complete before any system that uses `tunables()` is initialized. Today `gameState.ts` and other modules initialize at module-evaluation time (they run their constants inline). Threading async config loading into the boot sequence — before `ReactDOM.createRoot` and before `audioBus.init()` — requires changes to `main.tsx` and the preloader order. If done wrong, `tunables()` is called before `loadConfig()` resolves and throws at runtime. The existing tests will also need an updated setup to provide a mock config before module initialization.

## 6. Explicit Non-Goals

- **Do not create a separate package for shared types.** Types (`ZoneId`, `ObstacleType`, `PieceKind`, etc.) stay co-located with the module that owns them and are re-exported through that module's barrel.
- **Do not micro-modularize design tokens.** `src/hud/design/tokens.ts` and `typography.ts` stay where they are and are re-exported via `@/hud`.
- **Do not split `utils/math.ts` or `utils/rng.ts` into their own subpackages.** These are thin helpers with zero game-domain knowledge; they belong in `@/utils`.
- **Do not introduce a build step per subpackage.** This is a single Vite app. No Turborepo, no `tsc --build`, no `package.json` per directory.
- **Do not version subpackages.** They share the root `package.json` version and are not publishable.
