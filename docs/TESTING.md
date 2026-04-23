---
title: Testing
updated: 2026-04-23
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

### Visual-matrix regression gate

The visual-matrix suite catches the class of bug that subsystem-only tests miss: **what the driver actually sees** (App + Cockpit + TrackContent + StartPlatform + FinishBanner + feature layers + HUD, at the POV camera, at 8 distance checkpoints).

| File | Role |
|------|------|
| `src/app/VisualMatrix.browser.test.tsx` | Drives deterministic NIGHTMARE run via `?autoplay=1&phrase=lightning-kerosene-ferris` and dumps 8 PNGs (40m, 80m, 120m, 180m, 250m, 320m, 400m, 480m) into `.test-screenshots/visual-matrix/`. Browser-surface test — runs in `pnpm test:browser`. |
| `src/app/__tests__/visualMatrixBaseline.test.ts` | Node-surface test that diffs each current capture against the pinned baseline at `src/app/__baselines__/visual-matrix/`. Tolerance: 30% per-pixel drift (legitimate jitter from critter walk cycles, flower ornament spin, and sub-slice frame quantization is ~10-20%; a true regression like a lost mesh or doubled HUD drifts well past 30%). Skips gracefully when `.test-screenshots` doesn't exist. |

**When the diff fails:**
1. Run `pnpm test:browser VisualMatrix` to generate fresh captures
2. Visually inspect `.test-screenshots/visual-matrix/slice-NNNm.png` vs `src/app/__baselines__/visual-matrix/slice-NNNm.png`
3. If the new frame is correct (intentional visual change): `cp .test-screenshots/visual-matrix/slice-*.png src/app/__baselines__/visual-matrix/` and commit
4. If the new frame looks broken: investigate — you found a regression

**CI behavior:** browser and node tests run in separate jobs, so the node baseline-diff skips on CI (the baseline images were captured on real-GPU Chrome; CI swiftshader would produce different pixels). CI's safety net is the browser test's per-slice "PNG ≥ 20 KB" content gate. Local dev catches the subtle drifts.

### Track-only visual gate

The visual-matrix above captures the *integrated* scene (cockpit + track + audience + HUD). When a track-geometry change lands — new archetype, weight shift, descent profile — the integrated diffs swing wildly because cockpit pose + camera reaction also move. The track-only gate captures the procedural track in isolation so geometry regressions are reviewable without polish noise.

| File | Role |
|------|------|
| `src/track/__tests__/TrackPackage.browser.test.tsx` | Mounts JUST the procedural track (no cockpit, no obstacles, no audience) under three fixed cameras and dumps the renders. |
| `src/track/__baselines__/track-package/{side,plan,pov}.png` | Pinned baselines for the canonical seed phrase. |
| `src/track/__baselines__/archetypes/{archetype-id}.png` | One pinned baseline per archetype (`straight`, `slight-left`, `dip`, `plunge`, etc.) showing each piece in isolation, oriented so `deltaYaw` + `deltaPitch` are obvious. |
| `src/track/__tests__/trackPackageBaseline.test.ts` | Node-side diff against the pinned baselines (same 30% per-pixel tolerance as the integrated matrix). |

**Three captured renders per run:**

1. **Side elevation** — orthographic camera looking down +X at the track ribbon. Full run visible; pitch + descent are obvious. This is the gate for the descent vision (PRQ A-DESC-1) — a flat ribbon means the descent regressed.
2. **Top-down plan** — orthographic camera looking down -Y. Shows the spiral footprint.
3. **POV at d=0** — what the player sees in their first frame, with no cockpit chrome obstructing.

**Per-piece annotations are baked into the geometry render** (small text labels at piece boundaries showing archetype id + cumulative `(yaw, pitch, y)`). Reviewing the side-view PNG lets you read off the run's elevation profile at a glance.

**Workflow:**

```bash
# Generate fresh captures (browser test).
pnpm test:browser TrackPackage

# Diff against pinned baselines (node test).
pnpm test:node trackPackageBaseline

# Update baselines after an intentional geometry change:
cp .test-screenshots/track-package/*.png src/track/__baselines__/track-package/
cp .test-screenshots/track-package/archetypes/*.png src/track/__baselines__/archetypes/
```

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

## E1 stability soak

**File:** `e2e/stability-soak.spec.ts` — tagged `@nightly`, runs in the `stability-soak` CI job.

### What it asserts

| Assertion | Threshold | Checked |
|-----------|-----------|---------|
| No fatal errorBus events | 0 events | End of soak |
| No MAYHEM HALTED modal in DOM | 0 occurrences | Every 10s heartbeat + final |
| fps alive guard | fps > 20 | Every 10s heartbeat |
| Car actually drove | `distance > 1000m` at t=300s | End of soak |

The test drives the governor autopilot via `?autoplay=1&governor=1&phrase=lightning-kerosene-ferris&difficulty=kazoo` for 300 seconds (5 minutes). It polls `window.__mm.diag()` every 10 seconds (30 heartbeats total), takes a screenshot at each heartbeat, and persists them to `test-results/**/stability-soak/heartbeat-NNN.{png,json}`.

### What it records

Every heartbeat writes a JSON snapshot:

```json
{
  "heartbeat": 12,
  "elapsedMs": 120481,
  "fps": 58.4,
  "distance": 1842.3,
  "running": true,
  "gameOver": false,
  "mayhemHaltedVisible": false,
  "diag": { ... full DiagnosticsDump ... }
}
```

On failure the CI artifact `stability-soak-failure-<run_id>` contains:

- `heartbeat-NNN.png` — screenshot at each heartbeat
- `heartbeat-NNN.json` — diagnostics snapshot
- `errorBus-transcript.json` — all console errors + page errors with timestamps
- `summary.json` — rolled-up summary (final distance, final fps, heartbeat list)
- Playwright HTML report

### Why kazoo difficulty?

Kazoo keeps obstacles sparse so the autopilot naturally survives the full 5 minutes without a difficulty-triggered game-over collision cascade. The goal is to stress the *engine* (memory leaks, render hangs, error bus explosions) not the *difficulty balance*.

### How to reproduce locally

```bash
# Full soak (takes ~7 min with build):
pnpm build && pnpm exec playwright test e2e/stability-soak.spec.ts

# Or use the script:
pnpm e2e:stability-soak

# Watch it run in headed mode:
pnpm exec playwright test e2e/stability-soak.spec.ts --headed
```

The test fails loudly: if the preview server doesn't start, if the app doesn't mount within 30 seconds, or if the governor doesn't respond, these are treated as real failures — no silent skip.

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
