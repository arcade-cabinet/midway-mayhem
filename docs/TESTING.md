---
title: Testing
updated: 2026-04-18
status: current
domain: quality
---

# Testing

## 4-tier pyramid

```
Tier 4 — Maestro (native Android smoke)
Tier 3 — Playwright e2e (Chromium + WebKit + mobile viewports)
Tier 2 — Vitest browser (real Chromium GPU, WebGL required)
Tier 1 — Vitest node (pure logic, no DOM)
```

Run order matters: tier 1 is fastest and should always be green before running higher tiers.

---

## Tier 1 — Node unit tests

**Purpose:** Pure TypeScript logic with no DOM or WebGL dependency.

**Where files live:** `src/**/__tests__/*.test.ts` (no `.tsx`, no `browser` in filename)

**What to cover:**
- `src/game/` — run plan, combo, trick, damage, collision math, state machine transitions
- `src/track/` — track generator, zone system, daily route seed
- `src/utils/` — PRNG, math helpers, constants

**Coverage target:** ≥ 65% line coverage for `game/`, `src/ecs/systems/`, `utils/`.

**How to run:**
```bash
pnpm test:node
# or
pnpm test        # runs node + jsdom tiers
```

---

## Tier 2 — Browser tests (real GPU)

**Purpose:** R3F render components, WebGL-dependent logic, visual regression screenshots.

**Where files live:** `src/**/__tests__/*.browser.test.tsx` — also directly at `src/render/**/*.browser.test.tsx`

**Requirements:**
- Must run against real Chromium with hardware acceleration (ANGLE/GL)
- SwiftShader (software renderer) is NOT acceptable — postprocessing fails under it
- Uses `@vitest/browser` with the `playwright` provider

**What to cover:**
- Cockpit renders without error modal
- Track segments render without z-fighting or NaN geometry
- Zone banners appear and dismiss correctly
- Each tier 2 spec ends with a `__capture` or screenshot assertion

**How to run:**
```bash
pnpm test:browser
```

**To refresh visual baselines:**
```bash
pnpm e2e:update
```
(This reruns browser tests in update mode; accept new screenshots only when intentional.)

---

## Tier 3 — Playwright e2e

**Purpose:** Full game loop, multi-viewport matrix, governor autonomous run.

**Where files live:** `e2e/*.spec.ts`

**Test matrix:**
- Desktop Chromium (1280×720)
- Desktop WebKit
- Mobile Chrome (Pixel 5 viewport)
- Mobile Safari (iPhone 12 viewport)

Note: `webkit` may require manual install (`pnpm exec playwright install webkit`). CI runs Chromium only; WebKit is a local dev check.

**Required assertions in every spec:**
```ts
await expectNoErrorModal(page);   // at entry
// ... test body ...
await expectNoErrorModal(page);   // at exit
```

**Governor playthrough contract:**
- `?governor=1` activates `playthrough-governor.ts` (Yuka.js autonomous driver)
- Spec must complete ≥ 300 metres without dying
- Zone smoke: governor must enter at least Zones 1 + 2
- `readDiag()` helper reads `window.__mm.diag()` — requires `?diag=1` flag in `page.goto()`

**How to run:**
```bash
pnpm test:e2e
# With UI for debugging:
pnpm exec playwright test --ui
```

Playwright requires a running preview server. `test:e2e` starts it automatically via `webServer` config in `playwright.config.ts`.

Parallel workers: use `--workers=2` maximum. More than 2 workers causes GPU context contention on a single machine.

---

## Tier 4 — Maestro (Android native smoke)

**Purpose:** Verify Capacitor bridge is wired, SQLite persists across reloads, touch controls register on real Android hardware.

**Where files live:** `scripts/maestro-all.sh` + individual flow YAMLs in `maestro/` (or embedded in the shell script)

**How to run:**
```bash
bash scripts/maestro-all.sh
```

Requires:
- Maestro CLI installed (`curl -Ls "https://get.maestro.mobile.dev" | bash`)
- Android device/emulator connected via ADB
- Debug APK installed (`pnpm build:native && cap sync android && ./gradlew assembleDebug && adb install ...`)

---

## Test conventions

- Every new system needs a node unit test before the PR merges.
- Every new render component needs a browser screenshot test.
- E2E specs are integration checkpoints — they do not replace unit tests.
- No `test.only()` left in committed code.
- No `console.log()` in test files (use `expect` or `page.evaluate` assertions).
- `expect.hasAssertions()` is recommended for async tests.

---

## Known gaps (as of 2026-04-18)

- iPhone 14 Pro + mid-tier Android FPS unverified (no real-device baseline yet)
- Visual regression baselines not yet captured (pending first stable cockpit pass)
- `@vitest/browser/context` import path used in some test files should be `vitest/browser` — tracked as E3 in PLAN.md
- `seed-playthroughs.spec.ts` runs too many seeds; trim to 3 + nightly-full variant — tracked as E4 in PLAN.md
