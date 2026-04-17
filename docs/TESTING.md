---
title: Testing
updated: 2026-04-16
status: current
domain: quality
---

# Testing

## Strategy

Four-tier pyramid, all CI-gated:

```text
                    ┌──────────────────┐
                    │  E2E (Playwright) │   ← 15 tests, full chromium + mobile
                    │  1.4 min full run │
                    └─────────┬────────┘
                ┌─────────────┴──────────────┐
                │ Browser (Vitest + real     │   ← 4 tests, real WebGL
                │ chromium, WebGL)           │
                │ 4 sec                      │
                └─────────────┬──────────────┘
                ┌─────────────┴──────────────┐
                │ Component (Vitest + jsdom) │   ← 14 tests, DOM + events
                │ 0.8 sec                    │
                └─────────────┬──────────────┘
                ┌─────────────┴──────────────┐
                │ Unit (Vitest + node)       │   ← 42 tests, pure logic
                │ 0.3 sec                    │
                └────────────────────────────┘
```

## Commands

```bash
pnpm test              # node + jsdom (fast, precommit)
pnpm test:node         # pure logic
pnpm test:jsdom        # component + DOM
pnpm test:browser      # real Chromium WebGL
pnpm test:e2e          # full Playwright matrix (desktop + mobile)
pnpm test:surfaces     # everything, ordered
```

## What each tier tests

### Unit (node)
- `trackComposer` — piece placement math, cumulative distance, corner turning
- `gameState` — zustand store mutations, applyCrash, applyPickup, tick integration
- `errorBus` — halt-on-first, subscriber notification, cause-chain capture
- `obstacleSpawner` — deterministic per-seed, zone weighting, recycling
- `rng` — determinism, bounds, `dailySeed` stability
- `GovernorDriver` — steer clamping, obstacle avoidance, pickup seeking

### Component (jsdom)
- `<ErrorModal />` — appears on reportError, dismissible, multi-error subtitle
- `<HUD />` — panel presence, store reactivity, game-over overlay gating
- `<TitleScreen />` — brand text, start button → onStart
- `<ZoneBanner />` — zone name reactivity

### Browser (real Chromium WebGL)
- `<Cockpit />` mounts inside `<Canvas>` without throwing
- WebGL context established
- `<TrackSystem />` mounts with Suspense + drei useGLTF without throwing
- `<HUD />` renders correctly at 1280×720 with live store updates

### E2E (Playwright)

**Boot (5 tests):**
- Title screen loads with brand
- `?skip=1` drops into gameplay
- START button enters gameplay
- circus_arena HDRI is requested (preload verifies)
- No console errors during boot (tolerates audio autoplay warning)

**Gameplay (4 tests):**
- Distance increases over time during free-play
- Pointer steering moves player laterally (lateral diff > 0.1)
- HONK button clickable without error
- HUD reflects distance as run progresses

**Governor (2 tests):**
- Autonomous run drives > 300m, FPS > 25, crash rate < 0.05/meter
- Screenshots captured at t=3s, t=12s, t=25s (attached to test report)

**Error modal (2 tests):**
- Clean run shows NO modal
- 404 on HDRI → modal appears with exact path in message

**Mobile (2 tests, iPhone 14 Pro portrait):**
- Boots + renders HUD at portrait aspect
- HONK button reachable at safe-area, tap doesn't error

## Test factory pattern

`scriptedOutcomes.browser.test.tsx` proves each `PathOutcome` end-to-end using the test-factory pattern. This is the canonical approach for any test that needs to drive the game to a specific end state.

### How it works

```
seed → buildRunPlan(seed) → scriptForOutcome(plan, outcome)
    → ScriptedInput[]   (distance-triggered keyboard events)
        ↓
startRun({seed})
skipDropIn()             — set dropProgress=1 to bypass animation
installKeyboardSteer()   — window keydown/keyup → setSteer(±1/0)
makeScriptPlayer(script) — fires events when distance crosses dTrigger
startGameLoopDriver()    — turbo loop: 20 × 50ms ticks per 16ms wall-clock
    → runs until stopWhen(state) or deadline
```

### Turbo loop

The turbo loop runs 20 simulation steps of `dt=0.05s` per `setInterval(16)` callback. That is ~1 simulated second per 16ms real time — 62× faster than real time. A 4000m run at 30–70 m/s takes ~1–4s of wall time (vs 60–130s at 1:1 speed).

The script player is called **inside** each step (not in a separate interval) to guarantee no event is missed when the simulation advances many metres between wall-clock ticks.

### Outcome assertions

| Outcome | Stop condition | Assert |
|---|---|---|
| `finish-clean` | `distance >= plan.distance` | distance ≥ 95% of plan.distance |
| `collide-first` | `distance >= first.d` | lateral within 1.5 lane-widths of obstacle lane |
| `plunge-off-ramp` | `plunging || gameOver` | `plunging` or `gameOver` is true |
| `survive-30s` | `distance >= 900m` | `running || distance >= 810m`, crashes < 10 |

`plunge-off-ramp` requires the test to call `setCurrentPieceKind('rampLong')` once the car enters the ramp distance window, because `TrackSystem` is not mounted in the test. This simulates what the React component would report during live play.

### Adding a new outcome test

1. Add a `PathOutcome` value to `optimalPath.ts`
2. Implement the script generator in `scriptToXxx(plan)`
3. Add a `it(...)` block in `scriptedOutcomes.browser.test.tsx` that calls `runOutcome(seed, outcome, stopFn, timeoutMs)`
4. No React component mounting needed — the state machine drives everything

## Conventions

- All e2e specs call `expectNoErrorModal(page)` at entry AND exit.
- Test IDs are stable: `mm-game`, `mm-app`, `hud`, `hud-hype`, `hud-stats`, `hud-sanity`, `hud-crowd`, `honk-button`, `start-button`, `title-screen`, `error-modal`, `error-modal-context`, `error-modal-message`, `zone-banner`.
- `window.__mm.diag()` returns a JSON snapshot — tests read it via `await readDiag(page)`.
- Each e2e spec sets `test.setTimeout(...)` only when > 60s is really needed (governor 60s run is 120s timeout).

## Coverage targets (node unit)

```text
branches:   ≥ 50%
functions:  ≥ 65%
lines:      ≥ 65%
statements: ≥ 65%
```

Focused on `src/game/**`, `src/systems/**`, `src/utils/**` (core logic). Component + R3F not coverage-gated (they're exercised via jsdom + browser suites).

## Visual regression (planned)

Playwright `toHaveScreenshot` baselines for:
- Title screen at 1280×720
- Cockpit idle (no steering) at 1280×720 + 390×844 portrait
- Each zone entry (Midway Strip, Balloon Alley, Ring of Fire, Funhouse Frenzy)
- Each obstacle type in isolation (via diag API spawning at fixed distance)
- HUD in: idle / mid-run / crash / game-over states

Pixel tolerance 250px, color threshold 0.25 (permissive because HDRI lighting varies slightly per frame).

## Browser launch args (matches grailguard + marmalade-drops)

```text
--no-sandbox
--use-angle=default
--enable-features=WebGL,WebGL2
--enable-webgl
--ignore-gpu-blocklist
--use-gl=angle
--mute-audio
--disable-background-timer-throttling
--disable-backgrounding-occluded-windows
--disable-renderer-backgrounding
```

For CI under xvfb, these args activate real GPU rendering (vs SwiftShader).

## Flake mitigation

- `fullyParallel: false`, single worker — games tend to have timing dependencies
- `retries: 2` in CI, 0 locally
- `testTimeout: 60_000` base, `governor.setTimeout(120_000)` where needed
- `actionTimeout: 10_000` caps individual clicks
- Screenshots attached `only-on-failure` in CI, `on` locally

## Maestro native smoke tests

Six Maestro flows verify gameplay on real Android devices/emulators and iOS simulators. They run locally via the helper scripts or automatically in CI via `reactivecircus/android-emulator-runner` (api-33 / google_apis / x86_64). Screenshots land in `docs/media/maestro/{android,ios}/`.

### Preconditions

**Android (local):**
- Android SDK platform-tools installed (`adb` in PATH)
- Emulator running or device connected (`adb devices | grep "device$"`)
- Java 21 in PATH (`java -version`)
- Maestro CLI: `brew install mobile-dev-inc/tap/maestro`

**iOS (local):**
- Xcode installed, `xcrun simctl` available
- iOS Simulator booted (`xcrun simctl list devices booted`)
- Maestro CLI: `brew install mobile-dev-inc/tap/maestro`

### Commands

```bash
# Verify Maestro + toolchain are present
bash scripts/maestro-doctor.sh

# Full Android suite (builds APK, installs, runs all 6 flows)
pnpm qa:native:android         # calls scripts/native-smoke-android.sh
# or directly:
bash scripts/native-smoke-android.sh

# Full iOS suite (builds .app, installs, runs all 6 flows)
pnpm qa:native:ios             # calls scripts/native-smoke-ios.sh
# or directly:
bash scripts/native-smoke-ios.sh
```

### Flow inventory

| File | Platform | What it exercises | Screenshot |
|------|----------|-------------------|------------|
| `maestro/android-smoke.yaml` | Android | Boot → title → START → HUD visible | `android/boot.png` |
| `maestro/android-gameplay-30s.yaml` | Android | 10 steers, 5 honks, assert distance ≥ 100 m | `android/mid-run.png` |
| `maestro/android-critter-scare.yaml` | Android | Honk near critters, crowd panel visible | `android/critter-fleeing.png` |
| `maestro/android-ramp-trick.yaml` | Android | Airborne + WHEELIE (up+up), sanity panel visible | `android/trick.png` |
| `maestro/android-pause-resume.yaml` | Android | Background + foreground via Home key, HUD intact | — |
| `maestro/android-game-over.yaml` | Android | Crash to zero sanity, game-over overlay, restart | `android/game-over.png` |
| `maestro/ios-smoke.yaml` | iOS | Boot → title → START → HUD → HONK | `ios/boot.png` |
| `maestro/ios-gameplay-30s.yaml` | iOS | 10 steers, 5 honks, assert distance ≥ 100 m | `ios/mid-run.png` |
| `maestro/ios-critter-scare.yaml` | iOS | Honk near critters, crowd panel visible | `ios/critter-fleeing.png` |
| `maestro/ios-ramp-trick.yaml` | iOS | Airborne + WHEELIE, sanity panel visible | `ios/trick.png` |
| `maestro/ios-pause-resume.yaml` | iOS | Background + foreground, HUD intact | — |
| `maestro/ios-game-over.yaml` | iOS | Crash, game-over overlay, restart | `ios/game-over.png` |

### Key gameplay assertion (example from android-gameplay-30s)

```yaml
# Wait until the distance counter shows a 3-digit number ≥ 100 m.
# The hud-stats panel renders the value as bare text (e.g. "143").
# Maestro regex match: "1[0-9][0-9]" matches 100–199.
- extendedWaitUntil:
    visible:
      text: "1[0-9][0-9]"
    timeout: 30000
- assertNotVisible:
    id: "game-over"
```

### Pause/resume caveat

`android-pause-resume.yaml` and `ios-pause-resume.yaml` use OS home-key backgrounding rather than a tap target because the HUD does not yet expose a `pause-button` testId. When one is added, replace the `pressKey: Home` block with `tapOn: { id: "pause-button" }` + `assertVisible: { id: "pause-overlay" }`.

### Expected output

```text
[smoke:android] PASSED: android-smoke.yaml
[smoke:android] PASSED: android-gameplay-30s.yaml
[smoke:android] PASSED: android-critter-scare.yaml
[smoke:android] PASSED: android-ramp-trick.yaml
[smoke:android] PASSED: android-pause-resume.yaml
[smoke:android] PASSED: android-game-over.yaml
[smoke:android] ALL FLOWS PASSED.
```

Screenshots are written to `docs/media/maestro/android/` (Android) and `docs/media/maestro/ios/` (iOS) by the helper scripts. The CI job also uploads them as the `maestro-android-results` artifact.

## Difficulty telemetry

Two-layer verification that every difficulty tier is actually winnable:

### Layer 1 — Abstract solver (pure math, node test suite)

`src/game/difficultyTelemetry.ts` exposes `auditDifficulty(profile, seeds)` and `auditAllDifficulties(seeds)`. For each seed it:

1. Calls `buildRunPlan` (same planner as production) to get the full obstacle layout.
2. Calls `solveOptimalPath` to find the lane-by-lane avoidance path.
3. Replays every obstacle against the solver's chosen lane — any match is an unavoidable hit.

A tier **passes** when `obstaclesHit === 0` across all audited seeds (pass threshold = 100%).

Run against 100 deterministic seeds via:

```bash
pnpm audit:difficulty        # prints table, writes docs/telemetry/difficulty-balance.json
```

The JSON snapshot is committed so CI can diff regressions. The balance test in `src/game/__tests__/difficultyTelemetry.test.ts` uses 30 seeds and requires ≥80% pass rate — intentionally softer than the CLI so flaky seeds don't break CI on a low-powered runner.

### Layer 2 — Real-physics verification (browser test)

`src/game/__tests__/difficultyReal.browser.test.tsx` runs the **actual `useGameStore` physics loop** (not a mock) in a real Chromium process. It:

1. Starts a `silly` run with a fixed seed (42).
2. Injects `scriptForOutcome(plan, 'finish-clean')` keyboard events as distances are crossed.
3. Ticks the game loop at 50 ms fixed step until distance ≥ 4000 m.
4. Asserts `crashes === 0`.

This proves the abstract solver's geometry claim holds under real-time physics, sanity regen, speed ramp-up, and the lateral-clamp model.

### Solver fix

The abstract solver had a latent bug: when seeking a high-value pickup it could divert into a lane that held an obstacle 1–5 m ahead (pickup-seek waypoint placed 3 m before the pickup, but the obstacle was just after). The fix adds a `PICKUP_DANGER_LOOKAHEAD_M = 20` guard in `solveOptimalPath`: before accepting a pickup divert, check that the target lane is clear from `(pickup.d - 3)` to `(pickup.d + 17)`. This raised the solvability from 9% to 100% across 100 seeds.

## Known limitations

- No persistent `data-testid` yet on obstacles/pickups (they're instanced meshes) — collision tests rely on state snapshots via diag, not DOM queries.
- No balance-audit script yet (scheduled for E7.T8).
