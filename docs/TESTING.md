---
title: Testing
updated: 2026-04-19
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

**Purpose:** Full game loop, multi-viewport matrix, playthrough telemetry.

**Where files live:** `e2e/*.spec.ts` + shared factory in `e2e/_factory.ts`.

### Smoke vs nightly

The e2e suite is split by tag into two subsets with different owners:

| Subset | Tag | Runs on | Budget | Purpose |
|--------|-----|---------|--------|---------|
| **Smoke** | (untagged) | PR CI (`ci.yml`) | ≤ 20 min | Merge gate — does autoplay still boot, does the car move, does the HUD render |
| **Nightly** | `@nightly` | Scheduled + manual (`e2e-nightly.yml`), local dev | ≤ 45 min | Deep telemetry — per-interval dumps across 3 phrases + 3 viewports, determinism proofs |

Tests are tagged by adding `@nightly` to the describe or test name. Playwright `--grep @nightly` / `--grep-invert @nightly` filters at runtime.

**Smoke contents** (what runs on every PR):
- `playthrough-smoke.spec.ts` — 1 phrase × desktop × 5 × 1s frames ≈ 20s
- `governor-playthrough.spec.ts` test 2 (title screen load) — 9s
- `mobile-gameplay.spec.ts` tests 1–3 (compact layout, NEW RUN flow, touch controls) — mobile-gated, <20s each

**Nightly contents** (scheduled + on-demand, never gates merge):
- `seed-playthroughs.spec.ts` — 3 phrases × 15 frames × 2s intervals
- `determinism.spec.ts` — two 8-frame runs of the same seed
- `governor-playthrough.spec.ts` test 1 (5s autoplay drive) + test 3 (full NEW RUN modal flow)
- `mobile-gameplay.spec.ts` test 4 (9s autoplay drive on mobile)

### Project matrix

- `desktop-chromium` (1440×900)
- `mobile-portrait` (Pixel 7 device preset)
- `tablet-landscape` (1366×1024 + touch)

CI installs Chromium only. All three projects use the same Chromium binary under different device profiles.

### Artifacts

Every e2e run (smoke or nightly) uploads two CI artifacts:

| Artifact | Contents | Retention |
|----------|----------|-----------|
| `playwright-report` | HTML report with trace viewer | 14 days |
| `playthrough-dumps` (smoke) / `playthrough-dumps-nightly` | `frame-NN.png` + `frame-NN.json` + `summary.json` per (phrase × viewport) | 14 days (smoke), 30 days (nightly) |

The per-frame JSON is driven by `window.__mm.diag()` — the full diag dump shape lives in `src/game/diagnosticsBus.ts`. Diff two runs of the same seed to see exactly where behaviour changed.

### Contract for any new e2e spec

1. Use the `runPlaythrough` factory — hand-rolled click chains always rot when the UI changes.
2. Tag `@nightly` if the test takes more than ~30s, samples more than 6 frames, or does any kind of deep regression comparison. Leave untagged for smoke-gate material.
3. Set an explicit `test.setTimeout(...)` sized for the worst realistic CI run (not local dev). CI's xvfb-backed Chromium takes 2-3s per `page.screenshot()`.
4. Any assertion on pixel output belongs in `src/**/__baselines__/` via the real-GPU vitest-browser suite, NOT here — e2e snapshots break on font rendering + swiftshader differences across OS.

### How to run

```bash
pnpm e2e              # full matrix — both subsets
pnpm e2e:smoke        # merge-gate subset (what CI runs)
pnpm e2e:nightly      # deep telemetry (scheduled / on-demand)
pnpm exec playwright test --ui    # debug mode with step-through
```

Playwright auto-starts a `pnpm build && pnpm preview` server via the `webServer` config. Parallel workers are capped at 2 — more than 2 causes GPU context contention on a single machine.

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

## Known gaps (as of 2026-04-19)

- iPhone 14 Pro + mid-tier Android FPS unverified (no real-device baseline yet)
