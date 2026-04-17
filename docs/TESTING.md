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

Maestro tests verify the app launches, the start button is visible, and basic gameplay works on real devices. These run manually or in a device-farm CI step — they require a booted simulator or physical device.

### Preconditions

**iOS:**
- Xcode installed, iOS Simulator booted (`xcrun simctl list devices booted`)
- App installed on booted simulator: `xcrun simctl install booted <path/to/App.app>`
- Maestro CLI installed: `brew install mobile-dev-inc/tap/maestro`

**Android:**
- Android SDK platform-tools installed (`adb` in PATH)
- Emulator running or device connected (`adb devices`)
- App installed: `adb install <path/to/app-debug.apk>`
- Maestro CLI installed: `brew install mobile-dev-inc/tap/maestro`

### Commands

```bash
# Verify Maestro + toolchain are present
bash scripts/maestro-doctor.sh

# Run iOS smoke test (requires booted iOS Simulator)
bash scripts/native-smoke-ios.sh

# Run Android smoke test (requires connected device/emulator)
bash scripts/native-smoke-android.sh
```

### What the smoke tests check

1. App launches (`com.midwaymayhem.app`)
2. Title screen visible — `start-button` present within 15s
3. START button tappable — HUD appears (`hud` + `hud-hype` testIds)
4. iOS: HONK button tappable without error
5. Screenshot captured to `~/.maestro/tests/`

### Flows

| File | Platform |
|------|----------|
| `maestro/ios-smoke.yaml` | iOS Simulator |
| `maestro/android-smoke.yaml` | Android Emulator / Device |

### Expected output

```text
[smoke:ios] Running Maestro iOS smoke test...
[smoke:ios] Done. Screenshots in ~/.maestro/tests/
```

Screenshots are named `ios-smoke-gameplay.png` / `android-smoke-gameplay.png` and saved in the Maestro test output directory.

## Known limitations

- No persistent `data-testid` yet on obstacles/pickups (they're instanced meshes) — collision tests rely on state snapshots via diag, not DOM queries.
- No balance-audit script yet (scheduled for E7.T8).
