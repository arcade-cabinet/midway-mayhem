---
title: Midway Mayhem — Clown Car Chaos — Full Build PRD
updated: 2026-04-16
status: current
domain: product
---

# Feature: Midway Mayhem — Clown Car Chaos

**Created**: 2026-04-16
**Version**: 1.0
**Timeframe**: Multi-sprint — autonomous execution via `/task-batch`
**Priority**: P1 (flagship arcade-cabinet title)

## Overview

Translate the ChatGPT-produced single-file threejs prototype (`ChatGPT-Clown_Car_3D_Prototype.md`) into a production-grade cockpit-perspective arcade driving game using the proven **grailguard stack**:

- **Engine**: React Three Fiber (`@react-three/fiber`) + drei (`@react-three/drei`) + postprocessing (`@react-three/postprocessing`)
- **Build**: Vite + TypeScript + pnpm + Biome
- **Audio**: Tone.js (fully procedural — no audio assets)
- **Persistence**: Capacitor SQLite (native) / sql.js (web) via drizzle-orm, mirroring grailguard's `src/db/` pattern
- **Native**: Capacitor 8 (Android + iOS) with device detection to route SQLite driver selection
- **Web testing**: Vitest (node + jsdom + browser/Chromium) — mirror grailguard's 4-config vitest setup
- **E2E**: Playwright headed Chromium with GPU flags + **Yuka.js-based autonomous-driver governor** that plays the game from cockpit POV and captures screenshots each run
- **Native testing**: Maestro smoke scripts (mirror `grailguard/scripts/maestro-*.sh`)
- **CI/CD**: GitHub Actions `ci.yml` (PR validation), `release.yml` (release-please), `cd.yml` (Pages deploy + APK artifact)

The prototype is treated as a **rough reference only** for mechanics and feel — we will re-implement cleanly in R3F, elevate visuals with 21st.dev components for HUD/menus, custom GLSL shaders for track and sky, and full postprocessing (Bloom, Vignette, ChromaticAberration, DepthOfField, Noise).

Repository will be created as a **public repo** at `github.com/jbdevprimary/midway-mayhem` under the arcade-cabinet umbrella.

## Brand Lock (from ChatGPT dump — NON-NEGOTIABLE)

- **Name**: Midway Mayhem: Clown Car Chaos
- **Tagline**: Drive fast. Honk louder.
- **Palette**: Carnival Red `#E53935`, Gold Yellow `#FFD600`, Electric Blue `#1E88E5`, Clown Purple `#8E24AA`, Track Orange `#F36F21`, Night `#0B0F1A`
- **Fonts**: Bangers (headers), Rajdhani (UI/HUD)
- **Zones**: Midway Strip → Balloon Alley → Ring of Fire → Funhouse Frenzy → (expansion: Neon Nights, Arctic Circus, Space Carnival, Haunted Midway)
- **UI vocabulary**: SPEED→HYPE, HEALTH→SANITY, BOOST→LAUGH BOOST, SCORE→CROWD REACTION

## Dependencies

- Epic E1 (Foundation) blocks everything else
- Epic E2 (Core Gameplay) blocks E4 (Audio), E5 (Visuals), E6 (Persistence), E7 (Testing)
- Epic E3 (Visual Elevation) and E4 can run in parallel after E2
- Epic E7 (Testing Governor) requires E2 minimum; blocks E8 (CI/CD) gates
- Epic E9 (Native) requires E6 + E7 green

---

## Tasks

Each task has: **Description**, **Acceptance Criteria**, **Files**, **Verification**.

---

### EPIC E1 — FOUNDATION & REPO

#### E1.T1 — Create public GitHub repo under arcade-cabinet
- **Description**: Use `gh repo create jbdevprimary/midway-mayhem --public --description "Midway Mayhem: Clown Car Chaos — cockpit-perspective arcade driver"` then set `arcade-cabinet` topic. Init with README + MIT LICENSE + default `main` branch.
- **Acceptance Criteria**:
  - Repo exists and is public at `github.com/jbdevprimary/midway-mayhem`
  - Topic `arcade-cabinet` set via `gh api`
  - Default branch `main`, branch protection on
- **Verification**: `gh repo view jbdevprimary/midway-mayhem --json visibility,repositoryTopics`
- **Files**: (remote)

#### E1.T2 — Scaffold Vite + React 19 + TS + pnpm project
- **Description**: `pnpm create vite` with react-ts template, targeting React 19 (match grailguard). Add `.nvmrc` pinning Node 22 LTS.
- **Acceptance Criteria**:
  - `package.json` has `"type": "module"`, `"packageManager": "pnpm@10.32.0"`
  - `pnpm install && pnpm dev` boots Vite successfully
  - `tsconfig.json` with strict mode + `moduleResolution: "bundler"`
- **Verification**: `pnpm tsc --noEmit` exits 0, `pnpm dev` prints Vite URL
- **Files**: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `.nvmrc`, `.gitignore`

#### E1.T3 — Install game stack dependencies
- **Description**: Add: `three`, `@react-three/fiber@^9`, `@react-three/drei@^10`, `@react-three/postprocessing`, `postprocessing`, `tone@^15`, `yuka@^0.7`, `koota` (ECS — same as grailguard), `zustand` for game state, `framer-motion`, `@radix-ui/react-dialog`, `@radix-ui/react-tooltip`.
- **Acceptance Criteria**:
  - All packages install cleanly, no peer-dep warnings beyond acceptable
  - Versions pinned compatibly with grailguard's lockfile where overlap exists
- **Verification**: `pnpm install` clean, `pnpm ls @react-three/fiber three` shows resolved versions
- **Files**: `package.json`, `pnpm-lock.yaml`

#### E1.T4 — Biome lint/format + strict rules
- **Description**: `pnpm add -D @biomejs/biome@^2`, `pnpm biome init`. Copy relevant rules from `grailguard/biome.json` (strict React, import organize, no unused).
- **Acceptance Criteria**:
  - `pnpm lint` (alias `biome check .`) passes on empty repo
  - Format-on-save config documented
- **Verification**: `pnpm biome check .` exit 0
- **Files**: `biome.json`, `package.json` (scripts: `lint`, `lint:fix`, `format`)

#### E1.T5 — Required project docs
- **Description**: Create all mandatory docs per global CLAUDE.md: `CLAUDE.md`, `AGENTS.md`, `README.md`, `CHANGELOG.md` (Keep a Changelog 1.1.0), `STANDARDS.md`, `docs/ARCHITECTURE.md`, `docs/DESIGN.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md`, `docs/LORE.md`, `docs/STATE.md`. All with YAML frontmatter.
- **Acceptance Criteria**:
  - All files present with valid frontmatter (`title`, `updated`, `status`, `domain`)
  - `CLAUDE.md` references `AGENTS.md` for extended protocols
  - `docs/DESIGN.md` contains brand lock (palette, fonts, taglines, zone list)
- **Verification**: `ls CLAUDE.md AGENTS.md README.md CHANGELOG.md STANDARDS.md docs/*.md` all exist
- **Files**: Above list

#### E1.T6 — Governance: dependabot, release-please, commitlint
- **Description**: `.github/dependabot.yml` (weekly, group minor/patch), `release-please-config.json` + manifest (type: `node`), `.commitlintrc.json` (conventional commits).
- **Acceptance Criteria**: Files valid per schemas; release-please PR opens on first merge to main
- **Verification**: `gh workflow list` later shows release-please wired
- **Files**: `.github/dependabot.yml`, `release-please-config.json`, `.release-please-manifest.json`, `.commitlintrc.json`

---

### EPIC E2 — CORE GAMEPLAY (R3F PORT)

#### E2.T1 — Project file structure
- **Description**: Create directory tree matching the ChatGPT prompt structure but in TS:
  ```
  src/
    app/App.tsx, main.tsx, global.css
    components/ (Game, CameraRig, PlayerCar, TrackSystem, ObstacleSystem,
                 PickupSystem, Environment, Lighting, HUD, PauseMenu, TitleScreen)
    systems/ (trackGenerator.ts, obstacleSpawner.ts, collisionSystem.ts,
              inputSystem.ts, gameState.ts, zoneSystem.ts, audioBus.ts)
    hooks/ (useGameLoop, useSteering, useSpeed, useShake, useDeviceDetection)
    shaders/ (trackMaterial.glsl, skyDome.glsl, hazardPulse.glsl)
    utils/ (math.ts, constants.ts, rng.ts)
    db/ (mirror grailguard/src/db structure)
    engine/ (ECS world — koota)
    assets/ (procedural only at first)
    i18n/ (prepared, even if English-only initially)
  ```
- **Acceptance Criteria**: Directories exist with index barrel files where appropriate; no file > 300 LOC
- **Verification**: `find src -name '*.ts*' | xargs wc -l | awk '$1>300'` returns empty
- **Files**: Above tree

#### E2.T2 — Game state store (zustand + koota ECS)
- **Description**: Zustand store for session state: `distance`, `speedMps`, `hype`, `sanity`, `crowdReaction`, `crashes`, `currentZone`, `paused`, `gameOver`. Koota world for entities (player, obstacles, pickups, props).
- **Acceptance Criteria**:
  - Selectors memoized; state updates on rAF loop don't re-render HUD unnecessarily
  - Reset function restores to default run
- **Verification**: Unit test: `pnpm test -- gameState` covers mutations + reset
- **Files**: `src/systems/gameState.ts`, `src/engine/world.ts`, `src/systems/gameState.test.ts`

#### E2.T3 — Procedural track generator (spline + banking + hills)
- **Description**: Continuous-function track: `x = sin(d*0.009)*18 + sin(d*0.004)*12`, `y = sin(d*0.01)*4`, `z = -d`. Chunk-based BufferGeometry, generate ~600 units ahead of player, recycle behind. Support banking via chunk normal rotation. Lane dividers + guardrails as separate instanced meshes.
- **Acceptance Criteria**:
  - Track mesh updates without frame drops on M1 Mac at 60 FPS
  - Buffer recycling: geometry disposed properly, verified via `renderer.info.memory`
  - 4-lane width ~24 units, lane width ~5.5 units
- **Verification**: Playwright perf probe: `window.__diag.fps >= 55` after 10s of driving
- **Files**: `src/systems/trackGenerator.ts`, `src/components/TrackSystem.tsx`

#### E2.T4 — Input system (pointer / touch only — NO keyboard steering)
- **Description**: Desktop: mouse X → steering target. Mobile: touch drag. Smooth interpolation to center on release. Hookable via `useSteering()`.
- **Acceptance Criteria**:
  - Returns normalized `[-1, 1]` steering value
  - Exponential return-to-center (~0.25s tau)
  - Touch drag works on real mobile (verified via Maestro later)
- **Verification**: Vitest jsdom test simulating pointer events; Playwright test dragging touch
- **Files**: `src/hooks/useSteering.ts`, `src/systems/inputSystem.ts`

#### E2.T5 — Player car cockpit (hood, dashboard, steering wheel, gauges)
- **Description**: R3F `<PlayerCar />` with hood mesh, dashboard plane, steering wheel mesh (rotates with input), 2 procedural gauges as canvas textures (speedometer, crashometer). Subtle camera bob via `useShake` hook.
- **Acceptance Criteria**:
  - Steering wheel rotates ±35° mapped to steering input
  - Camera bob + speed shake + collision shake distinct and layered
  - Cockpit always visible at all zone lighting levels (emissive interior LED)
- **Verification**: Playwright visual regression snapshot `cockpit-idle.png`
- **Files**: `src/components/PlayerCar.tsx`, `src/hooks/useShake.ts`, `src/utils/cockpitTextures.ts`

#### E2.T6 — Camera rig (cockpit follow with lead-look + shake)
- **Description**: Camera locked to car, follows spline direction with slight lag, look-ahead offset scaled by speed, shake channel injection.
- **Acceptance Criteria**:
  - Camera never clips cockpit mesh
  - Lead-look smooth (no snapping); shake doesn't cause motion sickness
- **Verification**: Playwright 20-second governor playthrough — no NaN camera matrix
- **Files**: `src/components/CameraRig.tsx`

#### E2.T7 — Obstacle system (5 types incl. Hammer)
- **Description**: Implement all 5 from ChatGPT dump: Barrier, Cone Cluster, Gate, Oil Slick, **Hammer** (swings across lane, timing-based dodge). Spawn ahead of player via `obstacleSpawner.ts` with zone-weighted distribution.
- **Acceptance Criteria**:
  - Each type has distinct hitbox behavior (hard block, partial, forcing, lateral, timed)
  - Pool recycled — no new allocations after warmup
- **Verification**: Unit test for hitbox logic; visual regression per type
- **Files**: `src/components/ObstacleSystem.tsx`, `src/systems/obstacleSpawner.ts`, `src/components/obstacles/{Barrier,ConeCluster,Gate,OilSlick,Hammer}.tsx`

#### E2.T8 — Pickup system (Boost Ring, Tickets, Mega Boost)
- **Description**: Three pickup types with telegraphed glow + rotation. Mega Boost is rare, large speed spike + FX trigger.
- **Acceptance Criteria**:
  - Tickets persist to run score; boosts modify `hype`
  - Rarity tuned per zone
- **Verification**: `src/systems/pickupSpawner.test.ts` covers rarity distribution over 1000 spawns
- **Files**: `src/components/PickupSystem.tsx`, `src/systems/pickupSpawner.ts`

#### E2.T9 — Telegraph system (glow, color cues, animation)
- **Description**: Every hazard has an approach telegraph — color pulse, glow, stripes. Hammer visibly swings before dodge window. Boost rings rotate + emit. Barriers: yellow/red stripes.
- **Acceptance Criteria**:
  - Player understands obstacle intent from ≥40 units away
  - Colorblind-safe contrast (WCAG AA against track)
- **Verification**: Manual screenshot review + Lighthouse a11y pass on overlay HUD
- **Files**: `src/components/hazards/TelegraphFX.tsx`, `src/shaders/hazardPulse.glsl`

#### E2.T10 — Collision system (sphere-based) + lateral oil physics
- **Description**: Sphere-vs-sphere distance checks against obstacle pool. Oil modifies lateral velocity instead of direct speed. Collision emits: speed reduction, camera shake, UI flash, `crashes++`.
- **Acceptance Criteria**:
  - No false positives during gate threading
  - Oil feels distinct from solid hit
- **Verification**: Deterministic collision unit test with fixed seed
- **Files**: `src/systems/collisionSystem.ts`, `src/systems/collisionSystem.test.ts`

#### E2.T11 — Environment props (tents, balloons, light towers, signs)
- **Description**: Instanced procedural side decorations; never in play space. Zone-themed variants.
- **Acceptance Criteria**:
  - One draw call per prop type via `<Instances>`
  - Props recycle with camera movement
- **Verification**: `renderer.info.render.calls < 80` steady state
- **Files**: `src/components/Environment.tsx`, `src/components/props/*.tsx`

#### E2.T12 — Zone system (4 zones, transitions every ~450 units)
- **Description**: Midway Strip → Balloon Alley → Ring of Fire → Funhouse Frenzy, cycling. Each zone: unique color grading (shader uniforms + postprocess LUT), fog color, obstacle weighting, prop set. Announce banner slides in at boundary.
- **Acceptance Criteria**:
  - Smooth color/fog interpolation across boundaries (2-second ease)
  - Zone banner reads in <200ms
- **Verification**: Playwright: drive past 4 zone boundaries, verify overlay text updates
- **Files**: `src/systems/zoneSystem.ts`, `src/components/ZoneBanner.tsx`

#### E2.T13 — HUD (HYPE / DISTANCE / CRASHES / CROWD / zone banner)
- **Description**: Radix-based overlay. Uses Rajdhani font. Hype = speed, Crowd = score, Sanity optional gauge. Pause button, title return. Built with 21st.dev component inspirations where helpful.
- **Acceptance Criteria**:
  - HUD renders outside R3F canvas (DOM overlay) — no Three.js text perf hit
  - Mobile-safe areas respected
- **Verification**: Playwright: HUD text updates every frame without DOM thrash
- **Files**: `src/components/HUD.tsx`, `src/components/hud/*.tsx`

---

### EPIC E3 — VISUAL ELEVATION (21st.dev + shaders + postprocessing)

#### E3.T1 — Custom GLSL track shader (Hot Wheels plastic)
- **Description**: Replace stock MeshStandardMaterial with custom ShaderMaterial: saturated orange base, specular rim highlight, anisotropic-ish sheen, subtle normal perturbation for track segments.
- **Acceptance Criteria**: Matches Hot Wheels "molded plastic" feel; single pass, no alpha
- **Verification**: Visual regression snapshot vs. baseline
- **Files**: `src/shaders/trackMaterial.glsl.ts`, `src/materials/TrackMaterial.ts`

#### E3.T2 — Sky dome shader (gradient + star field per zone)
- **Description**: Zone-driven sky: Midway=dusk, Balloon=pastel day, Ring of Fire=red-hot, Funhouse=strobe neon. Fragment shader with gradient + noise stars.
- **Acceptance Criteria**: Zero performance regression; zone transition tweens sky uniforms
- **Files**: `src/shaders/skyDome.glsl.ts`, `src/components/SkyDome.tsx`

#### E3.T3 — Full postprocessing stack (`@react-three/postprocessing`)
- **Description**: Effects (tuned subtly per ChatGPT NO-OVERUSE rule):
  - `Bloom` (intensity 0.4, luminanceThreshold 0.75)
  - `DepthOfField` (focus on cockpit when idle, track when moving — via pointer)
  - `Vignette` (offset 0.3, darkness 0.5)
  - `ChromaticAberration` (very light, pulses on boost)
  - `Noise` (0.02, only at night zones)
- **Acceptance Criteria**: 60 FPS maintained on M1; user-togglable via Settings
- **Files**: `src/components/PostFX.tsx`

#### E3.T4 — Title screen + menus (21st.dev-assisted)
- **Description**: Animated title with Bangers font, clown color gradient, steering-wheel logo motif. Start, Continue, Settings, Credits. Use `mcp__magic__21st_magic_component_inspiration` to find polished menu patterns, then adapt.
- **Acceptance Criteria**: Accessible (keyboard nav), mobile-touch friendly, branded
- **Files**: `src/components/TitleScreen.tsx`, `src/components/menus/*.tsx`

#### E3.T5 — Logo + favicon SVG system
- **Description**: Produce SVG logo (MIDWAY arched, MAYHEM grounded, steering-wheel "O"). Generate PWA icons (192, 512, maskable). Use `mcp__magic__logo_search` for inspiration only, then draw vectors manually to brand.
- **Files**: `public/logo.svg`, `public/icon-*.png`, `public/favicon.ico`

#### E3.T6 — Particle FX (crash debris, boost streaks, zone transitions)
- **Description**: GPU particles via drei `<Points>` / custom shader. Crash: spark shower. Boost: speed-line streaks. Zone change: confetti burst.
- **Acceptance Criteria**: Pool size capped; no GC pauses during sustained play
- **Files**: `src/components/fx/*.tsx`

---

### EPIC E4 — PROCEDURAL AUDIO (Tone.js)

#### E4.T1 — Audio bus with latency-safe Tone.js init
- **Description**: Single `AudioBus` singleton. Lazy `Tone.start()` on first user gesture. Master compressor + limiter. Channels: engine, FX, ambient, honk, ui.
- **Acceptance Criteria**: No autoplay policy violation; bus handles tab backgrounding
- **Files**: `src/systems/audioBus.ts`

#### E4.T2 — Engine hum (procedural, speed-reactive)
- **Description**: Two detuned oscillators + noise, pitched by `speedMps`. Subtle LFO for vibration. Duty cycle on boost.
- **Acceptance Criteria**: Engine audibly speeds up on hype increase
- **Files**: `src/systems/audio/engine.ts`

#### E4.T3 — Honk (multi-voice clown honk with pitch variance)
- **Description**: Harmonic chord (comedic minor 7th) + pitch-bend envelope. Click/tap steering wheel triggers.
- **Acceptance Criteria**: Each honk slightly different (random detune) — never identical twice
- **Files**: `src/systems/audio/honk.ts`

#### E4.T4 — Crash + pickup + boost SFX
- **Description**: Procedural: crash = filtered noise burst + metal crunch; pickup = bell ping; boost = swept synth whoosh; mega boost = big pitched-up chord hit.
- **Files**: `src/systems/audio/sfx.ts`

#### E4.T5 — Adaptive ambient music bed per zone
- **Description**: Four ambient Tone.js arrangements — carnival waltz (Midway), airy pad (Balloon), pulsing techno (Ring of Fire), glitchy carousel (Funhouse). Crossfade on zone transition. All procedural — zero audio assets.
- **Acceptance Criteria**: Seamless crossfade; total CPU <5% on idle
- **Files**: `src/systems/audio/ambient.ts`

---

### EPIC E5 — PERSISTENCE (Capacitor SQLite + drizzle — grailguard pattern)

#### E5.T1 — Mirror grailguard DB layer
- **Description**: Copy pattern from `/Users/jbogaty/src/arcade-cabinet/grailguard/src/db/`:
  - `client.ts` — driver selection (sql.js web / CapacitorSQLite native)
  - `DatabaseProvider.tsx` — React context
  - `schema.ts` — drizzle schema
  - `migrations.ts` — migration runner
  - `useLiveQuery.ts` — React hook
- Copy the `pnpm copywasm` script verbatim for sql.js wasm.
- **Acceptance Criteria**: Same exact pattern, adapted for Midway Mayhem schema
- **Files**: `src/db/*.ts`, `package.json` (scripts copied)

#### E5.T2 — Device detection for driver choice
- **Description**: `useDeviceDetection` hook uses Capacitor's `Capacitor.isNativePlatform()` + `Capacitor.getPlatform()` to choose sql.js (web) vs `@capacitor-community/sqlite` (iOS/Android). Handle jeep-sqlite init for web fallback.
- **Acceptance Criteria**: Web run uses sql.js; native run uses CapacitorSQLite; logged at startup
- **Files**: `src/hooks/useDeviceDetection.ts`, `src/db/client.ts`

#### E5.T3 — Schema (runs, bests, settings, meta)
- **Description**:
  - `runs` — id, seed, startedAt, endedAt, distance, crashes, score, zonesReached, durationSec
  - `bests` — zone, bestDistance, bestScore
  - `settings` — key/value (mute, postFxLevel, controlScheme)
  - `meta_progress` — unlocks, cosmetics (future-proof)
- **Acceptance Criteria**: Migrations idempotent; drizzle types exported
- **Files**: `src/db/schema.ts`, `src/db/migrations/0001_initial.sql`

#### E5.T4 — Save envelope + autosave on zone boundary + game over
- **Description**: Mirror `grailguard/src/db/saveEnvelope.ts` pattern. Autosave triggers: zone transition, pause, game-over, pagehide.
- **Acceptance Criteria**: `runs` row persisted across reload; resume shows continue option
- **Verification**: Playwright `persistence.spec.ts` — start run, reload, verify run row exists
- **Files**: `src/db/saveEnvelope.ts`, `src/db/repos/runsRepo.ts`

---

### EPIC E6 — NATIVE (CAPACITOR 8)

#### E6.T1 — Capacitor init + platform folders
- **Description**: `pnpm add -D @capacitor/cli @capacitor/core @capacitor/android @capacitor/ios @capacitor-community/sqlite @capacitor/haptics @capacitor/app`. `capacitor.config.ts` with `appId: com.arcadecabinet.midwaymayhem`.
- **Acceptance Criteria**: `pnpm cap sync` completes for both platforms
- **Files**: `capacitor.config.ts`, `android/`, `ios/`

#### E6.T2 — Android debug APK build pipeline
- **Description**: `pnpm native:android:debug` script: `build:native && cap sync android && ./gradlew assembleDebug`. Mirror grailguard's script exactly.
- **Acceptance Criteria**: APK lands in `android/app/build/outputs/apk/debug/`
- **Files**: `package.json` scripts

#### E6.T3 — iOS simulator build
- **Description**: `pnpm native:ios:build` script mirroring grailguard's xcodebuild invocation for iPhone 16 sim.
- **Files**: `package.json` scripts

#### E6.T4 — Haptics on crash / boost / pickup
- **Description**: `@capacitor/haptics` calls (LIGHT on pickup, MEDIUM on boost start, HEAVY + notification on crash). No-op on web.
- **Files**: `src/systems/hapticsBus.ts`

---

### EPIC E7 — TESTING + YUKA GOVERNOR + SCREENSHOT CAPTURE

#### E7.T1 — Vitest 4-config setup (mirror grailguard)
- **Description**: Copy grailguard's vitest config pattern:
  - `vitest.shared.ts` — base config
  - `vitest.node.config.ts` — logic, no DOM
  - `vitest.jsdom.config.ts` — React component tests
  - `vitest.browser.config.ts` — real Chromium for shader / canvas tests
- **Acceptance Criteria**: `pnpm test` runs node + jsdom; `pnpm test:browser` runs browser
- **Files**: 4 vitest configs, `package.json` scripts

#### E7.T2 — Playwright config with GPU-accelerated headed Chromium
- **Description**: Copy `grailguard/playwright.config.ts` flags verbatim (`--use-angle=default`, `--enable-webgl`, etc.). Dev server projects for gameplay-desktop + gameplay-mobile (emulated viewport).
- **Acceptance Criteria**: Playwright spins up Vite preview + runs with real WebGL
- **Files**: `playwright.config.ts`

#### E7.T3 — Yuka.js cockpit-POV autonomous driver (GOVERNOR)
- **Description**: Build a Yuka-based autonomous agent that plays Midway Mayhem from cockpit view:
  - `GovernorDriver` extends Yuka `Vehicle`
  - Consumes upcoming track centerline points
  - Consumes visible obstacle list via diagnostics dump (`window.__mm.diag`)
  - Yuka steering behaviors: `FollowPathBehavior` (track), `ObstacleAvoidanceBehavior` (hazards), `SeekBehavior` (pickups — weighted lower than avoid)
  - Outputs a steering value fed into the same `useSteering` input channel — so the game doesn't know a bot is driving
- **Acceptance Criteria**:
  - Governor completes a 2-minute run with ≤5 crashes on default difficulty
  - Feeds input via the same pointer/touch channel real players use
  - Can be toggled on via `?governor=1` URL param
- **Verification**: `pnpm test:e2e -- governor.spec.ts` — asserts governor completes run, crash count, FPS
- **Files**: `src/systems/governor/GovernorDriver.ts`, `src/systems/governor/behaviors.ts`, `e2e/governor.spec.ts`

#### E7.T4 — Diagnostics window object (window.__mm.diag)
- **Description**: Mirror grailguard's `window.__grailguard` pattern. Expose: fps, entities, track lookahead points, obstacle list, pickup list, player pose, zone, session state. Only enabled when `import.meta.env.DEV` or `?diag=1`.
- **Acceptance Criteria**: JSON-serializable dump; governor reads it each tick
- **Files**: `src/systems/diagnosticsBus.ts`

#### E7.T5 — Screenshot capture each run (Playwright + governor)
- **Description**: `governor.spec.ts` captures screenshots at: 5s, 30s, 60s, 120s, zone-boundary, crash, and game-over. Save under `e2e/screenshots/{runId}/`. Compare against baselines in `e2e/screenshots/__baseline__/` via `toHaveScreenshot` (pixel tolerance 100).
- **Acceptance Criteria**: Snapshot dir populated on every e2e run; CI artifacts uploaded on failure
- **Files**: `e2e/governor.spec.ts`, `.github/workflows/ci.yml` (artifact upload)

#### E7.T6 — Visual regression suite (per zone, per obstacle type)
- **Description**: Playwright specs:
  - `zones.spec.ts` — screenshot each zone entry
  - `obstacles.spec.ts` — spawn each obstacle in isolation via diag API
  - `hud.spec.ts` — HUD in idle / mid-run / crash / game-over states
  - `cockpit.spec.ts` — cockpit idle (matches brand)
- **Files**: `e2e/*.spec.ts`

#### E7.T7 — Gameplay flow e2e (mirror grailguard/e2e/gameFlow.spec.ts)
- **Description**: Title → Start → drive 30s → pause → resume → crash → game over → restart.
- **Acceptance Criteria**: Happy path 100% green in CI headed xvfb
- **Files**: `e2e/gameFlow.spec.ts`

#### E7.T8 — Balance audit script (mirror grailguard/scripts/run-balance-audit.mjs)
- **Description**: Script runs governor N times, collects stats (avg distance, crash rate, zone distribution, pickup rate). Compare between commits via `compare-balance-audits.mjs` pattern.
- **Files**: `scripts/run-balance-audit.mjs`, `scripts/compare-balance-audits.mjs`

#### E7.T9 — Maestro native smoke scripts (mirror grailguard)
- **Description**: Copy `grailguard/scripts/maestro-*.sh` pattern. `test:maestro` — launch, tap start, drive 15s, verify HUD visible.
- **Acceptance Criteria**: `pnpm test:maestro:doctor` passes locally
- **Files**: `scripts/maestro-*.sh`, `e2e/maestro/*.yaml`

#### E7.T10 — Test surfaces checker
- **Description**: Mirror `scripts/check-test-surfaces.mjs` — guard against missing `data-testid` on required interactive elements.
- **Files**: `scripts/check-test-surfaces.mjs`

---

### EPIC E8 — CI/CD

#### E8.T1 — ci.yml (PR validation, no branch filter)
- **Description**: Jobs: lint, typecheck, test (node+jsdom), test:browser, test:e2e (headed under xvfb-run), build, android APK debug build (uploaded as PR artifact). Uses `actions/checkout@v6`, Node 22, pnpm setup.
- **Acceptance Criteria**: First PR opens with all green checks; APK downloadable from Actions run
- **Files**: `.github/workflows/ci.yml`

#### E8.T2 — release.yml (release-please tag trigger — build artifacts)
- **Description**: On release-please tag, build production web bundle, sign Android release APK, draft release with assets.
- **Files**: `.github/workflows/release.yml`

#### E8.T3 — cd.yml (push: main — deploy web to Pages)
- **Description**: Deploy `dist/` to GitHub Pages under `/midway-mayhem/`. Set Vite `base: '/midway-mayhem/'`.
- **Acceptance Criteria**: Playable at `https://jbdevprimary.github.io/midway-mayhem/`
- **Files**: `.github/workflows/cd.yml`

#### E8.T4 — Sentry (web + Capacitor) optional wiring
- **Description**: `@sentry/react` + `@sentry/capacitor` with DSN from env. Mirror grailguard's setup; default off until DSN provided.
- **Files**: `src/app/sentry.ts`

---

### EPIC E9 — POLISH & "FULLY FUN" BEYOND CHATGPT

These are the items I'm adding on top of ChatGPT's list to make the game *actually fun*:

#### E9.T1 — Run scoring + multipliers (crowd-reaction combos)
- **Description**: Consecutive pickups without crash = multiplier. Mega boost + chain = fireworks. Displayed as `CROWD REACTION x3.4!` banner.
- **Files**: `src/systems/scoring.ts`

#### E9.T2 — Daily seed (procedural challenge mode)
- **Description**: Date-seeded PRNG → deterministic track + obstacle layout. Leaderboard-ready (local first, future remote).
- **Files**: `src/systems/dailyChallenge.ts`

#### E9.T3 — Unlockable cosmetics (cars, honks, cockpit decals)
- **Description**: Unlock via tickets. Rotating honks (air-horn, clown squeak, party horn, trombone-wah). Persisted in meta_progress table.
- **Files**: `src/systems/cosmetics.ts`, `src/components/cosmetics/*.tsx`

#### E9.T4 — Accessibility pass
- **Description**: Reduce-motion mode (disable shake, postFX). Colorblind-safe palette swap. Optional rumble. Text size scaling. Captions for audio events.
- **Files**: `src/app/a11y.ts`, `src/components/SettingsDialog.tsx`

#### E9.T5 — Mobile performance tier detection
- **Description**: Detect low/mid/high tier via GPU renderer string + initial frame timing. Auto-scale postFX, particle count, draw distance.
- **Files**: `src/systems/perfTier.ts`

#### E9.T6 — Achievements (10 launch set)
- **Description**: First zone reached, First Mega Boost, No-crash 60s, All zones in one run, 10k CROWD, Hammer dodge streak 5, etc. Persisted in meta_progress.
- **Files**: `src/systems/achievements.ts`

#### E9.T7 — Tutorial cockpit (first-launch guided first 15 seconds)
- **Description**: Inline prompts: "Move to steer", "Tap wheel to HONK", "Hit rings to boost". Dismissable.
- **Files**: `src/components/Tutorial.tsx`

#### E9.T8 — PWA install + offline cache
- **Description**: `vite-plugin-pwa` with precache + runtime cache. Installable on mobile, works offline.
- **Files**: `vite.config.ts`, `public/manifest.webmanifest`

#### E9.T9 — Performance HUD (dev-only overlay)
- **Description**: FPS / ms / draw calls / entity count — toggle with `?perf=1` or `` ` `` key.
- **Files**: `src/components/PerfHUD.tsx`

#### E9.T10 — Launch trailer screenshot sheet
- **Description**: Governor captures 12 curated high-moment screenshots for store listing. Saved to `docs/marketing/`.
- **Files**: `scripts/capture-marketing.mjs`

---

## Execution Order (by dependency)

1. **E1 Foundation** (serial) — T1→T2→T3→T4→T5→T6
2. **E2 Core Gameplay** (mostly serial, some parallel) — T1→T2→(T3∥T4)→T5→T6→(T7∥T8)→T9→T10→T11→T12→T13
3. **E5 Persistence** — can start after E2.T2 (state store exists)
4. **E3 Visual** + **E4 Audio** + **E7 Testing skeleton** — parallel after E2 core playable (~E2.T10)
5. **E6 Native** — after E5 green
6. **E7 Governor + screenshot spec** — after E2.T10 (collisions work) + E7.T4 (diag bus)
7. **E8 CI/CD** — wire `ci.yml` early (after E1.T4), add stages as tests land
8. **E9 Polish** — parallel final sprint, any time after E2 + E3 + E4 stable

## Risks

- **R1**: Chromium headed + xvfb WebGL flakiness in CI. **Mitigation**: copy grailguard's exact flags; 2 retries on CI.
- **R2**: Tone.js CPU under heavy postFX. **Mitigation**: audio in AudioWorklet where feasible; cap simultaneous voices.
- **R3**: Capacitor SQLite API drift between v8 versions. **Mitigation**: pin to grailguard's exact `@capacitor-community/sqlite@^8.0.1`.
- **R4**: Yuka governor overfitting to perfect track and masking player-experience bugs. **Mitigation**: introduce controlled jitter in steering + vary skill level params; keep human playtest in loop.
- **R5**: 300-LOC file cap vs. complex R3F components. **Mitigation**: lean on hooks + subcomponent composition; audit with `find src -name '*.tsx' | xargs wc -l`.
- **R6**: Asset-free procedural audio may feel thin. **Mitigation**: invest in Tone.js per-zone arrangements (E4.T5) + layered FX.

## Technical Notes

- **Reference repo**: `/Users/jbogaty/src/arcade-cabinet/grailguard` — copy patterns for: db layer, vitest configs, playwright config, maestro scripts, balance audit, capacitor config. Do NOT copy grailguard business logic.
- **Prototype reference**: `/Users/jbogaty/src/arcade-cabinet/midway-mayhem/ChatGPT-Clown_Car_3D_Prototype.md` — ideas + brand + mechanics; DO NOT port the HTML directly. Re-implement cleanly.
- **Stack versions locked**: React 19.2, R3F 9.x, drei 10.x, three 0.163, tone 15.x, yuka 0.7.8, capacitor 8.x, sql.js 1.11, drizzle-orm 0.45.
- **Workflow order**: `ci.yml` (PR) → `release.yml` (tag) → `cd.yml` (main deploy). Builds live in release; cd only deploys.
- **Magic MCP**: use `mcp__magic__21st_magic_component_inspiration` for HUD, menus, pause dialogs. Adapt, don't copy verbatim.

## Success Criteria (ChatGPT's, confirmed)

- Player instinctively steers within 10 seconds
- Feels speed immediately
- Understands obstacles without thinking
- Smiles within 30 seconds
- **PLUS**: Yuka governor can complete a 2-minute autonomous run at ≥55 FPS with ≤5 crashes, producing visual-regression-stable screenshots per zone.
