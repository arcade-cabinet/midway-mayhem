---
title: Code Quality + Architecture + CI/CD Audit
updated: 2026-04-18
status: current
domain: quality
---

# Midway Mayhem — Code Quality, Architecture & CI/CD Audit

**Commit:** 3b749eb (post-PR #21 + #22 merge) — branch `main`
**Scope:** three tracks — (1) smells/dead code, (2) architecture compliance vs the five v2 rules in `CLAUDE.md`, (3) CI/CD + test infra.
**LOC:** 24,284 TS/TSX across 200 files. Largest: `src/game/gameState.ts` (788), `src/render/Track.tsx` (402), `src/game/obstacles/useObstacleFrame.ts` (315).

Priority legend: **P0** = blocks ship / rule-breach. **P1** = next sprint. **P2** = opportunistic.
Effort legend: **trivial** (≤15 min), **small** (≤1 hr), **medium** (≤half day), **large** (>half day).
Owner legend: **self** (user fixes directly) — **specialist agent** = dispatch an agent (e.g. `code-reviewer`, `refactor-specialist`).

---

## Track 1 — Code smells + dead code

### 1.1 Dead / duplicate UI modules (pre-restructure leftovers)

| # | File | Issue | Recommended fix | Priority | Effort | Owner |
|---|------|-------|-----------------|----------|--------|-------|
| 1 | `src/ui/TitleScreen.tsx` | Pre-restructure TitleScreen, superseded by `src/ui/title/TitleScreen.tsx` (App.tsx imports the latter). Referenced from nowhere. | Delete file + its only import-site (none — nothing imports it). | P1 | trivial | self |
| 2 | `src/ui/GameOverOverlay.tsx` | Two `GameOverOverlay` components exist: `ui/GameOverOverlay.tsx` (used by App.tsx) and `ui/hud/GameOverOverlay.tsx` (used by `ui/hud/HUD.tsx`). Both render concurrently — App.tsx renders the outer one AND `<HUD/>` which includes the inner one. Results in potential double game-over surfaces. | Consolidate to one. The `ui/hud/` one has the newer prop shape; retire the outer. Remove stray `<GameOverOverlay>` from App.tsx; move it inside HUD or have HUD own the entire end-of-run UI. | P1 | small | self |
| 3 | `src/storage/scores.ts` | Replaced by the new `src/persistence/` stack (lifetimeStats, profile, replay). Still imported by `src/app/App.tsx:38` and `src/ui/TitleScreen.tsx`. | Migrate score persistence to `lifetimeStats` / `replay` and delete `src/storage/`. | P1 | medium | specialist agent |

### 1.2 Hardcoded-numbers-in-.ts that violate rule #1

Rule #1: all tunable numbers live in JSON. Current violations:

| # | File:line | Issue | Recommended fix | Priority | Effort | Owner |
|---|-----------|-------|-----------------|----------|--------|-------|
| 4 | `src/utils/constants.ts:40-82` | `TRACK`, `HONK`, `STEER` constants are literals. File itself tags them `TODO(Task #124): replace with tunables()`. These are hot-path gameplay tuning knobs. | Add `track`, `honk`, `steer` blocks to `src/config/tunables.json` + zod schema; import via `tunables.steer.MAX_LATERAL_MPS` etc. Keep `COLORS`, `ZONES`, `OBSTACLE_TYPES` enums in `.ts` (identity, not tuning). | **P0** | medium | specialist agent |
| 5 | `src/game/obstacles/obstacleSpawner.ts:49-69` | `SPAWN` gaps, `CRITTER_THRESHOLDS`, `ZONE_WEIGHTS` all hardcoded literals, self-tagged `TODO(Task #124)`. Gameplay pacing lives in code, not data. | Add `obstacles.spawn`, `obstacles.critterThresholds`, `obstacles.zoneWeights` to `tunables.json`. | **P0** | medium | specialist agent |
| 6 | `src/render/Track.tsx:30-36` | Geometry constants (`SEGMENT_SUBDIVISIONS`, `SLAB_DEPTH`, `LANE_STRIPE_WIDTH`, `CURB_CHUNK_LENGTH`) are literals inside `.tsx`. Double violation: rule #1 (numbers-in-code) and arguably rule #1 again (numbers-in-render). | Move to `tunables.trackGeometry` block. These change with mobile-vs-desktop scaling. | P1 | small | self |
| 7 | `src/render/cockpit/PlayerCar.tsx:68` | `lateralLimit = 10` magic number mid-render. | Move to `tunables.cockpit.lateralLimitM`. | P2 | trivial | self |
| 8 | `src/render/TrackContent.tsx:187` | `BALLOON_COLORS[id % BALLOON_COLORS.length] ?? BALLOON_COLORS[0]` — the `??` is theoretically unreachable but passes silently. | Switch to `const c = BALLOON_COLORS[id % BALLOON_COLORS.length]; if (!c) throw new Error(...)`. | P2 | trivial | self |

### 1.3 Math-in-.tsx violating rule #1 (second half — "math in `.tsx` is wrong")

The rule strictly reads "math in .tsx is wrong." Reality check: R3F idiom is `useFrame` with per-frame `Math.sin/cos` for animation, and extracting *every* trig call into a logic module is both impractical and counterproductive. Pragmatic reading: **state-changing / simulation math** must live in `.ts`; **presentational oscillation / sampling** can stay in render. Flag where simulation-like math has leaked into render:

| # | File:line | Issue | Recommended fix | Priority | Effort | Owner |
|---|-----------|-------|-----------------|----------|--------|-------|
| 9 | `src/render/cockpit/PlayerCar.tsx:66-102` | `useFrame` directly calls `useGameStore.getState()`, calls `sampleTrack(s.distance)`, computes `angle = Math.atan2(...)`, and writes transforms. This is simulation-adjacent coupling: the render component is *deriving* motion state instead of reading a pre-computed pose. | Move to an ECS system: a `PlayerPose` trait populated by `playerMotion.ts` each tick; `PlayerCar.tsx` reads `pe.get(PlayerPose)` and sets transforms only. | P1 | medium | specialist agent |
| 10 | `src/render/Track.tsx:73-98` `sampleStation()` | ~30 lines of pure pose integration math (yaw/pitch/bank rotation composition) inside `.tsx`. Already duplicated-ish with `ecs/systems/trackSampler.ts`. | Move `sampleStation` + `buildTrackGeometry` to `src/track/trackGeometry.ts` (pure TS); `Track.tsx` becomes a thin adapter that turns `BuiltGeo` into `<mesh>` nodes. | P1 | medium | specialist agent |
| 11 | `src/render/obstacles/FireHoopGate.tsx:170-173`, `BarkerCrowd.tsx:173`, `ExplosionFX.tsx:49-51` | Pure presentational oscillation (flame flicker, crowd wave, particle spray). | **Keep as-is.** This is R3F idiom. Update `CLAUDE.md` rule #1 to say "simulation math in `.tsx` is wrong" instead of "math in `.tsx` is wrong," so the rule stays teachable. | P2 | trivial | self |

### 1.4 TODO / FIXME / in-flight-port comments (stubs)

All flagged TODOs are from the v2 port — gameState shim wiring, manifest port, Task #124 tunables rollout. Count: 21 TODOs across 14 files. No FIXMEs, no XXXs, no HACKs. Representative set:

| # | File:line | Description | Priority |
|---|-----------|-------------|----------|
| 12 | `src/audio/tireSqueal.ts:12, 132` | `subscribe()` wiring deferred to Task #125; method body is a no-op stub that returns `() => {}`. Function is shipped but inert. | P1 |
| 13 | `src/audio/conductor.ts:18` | TODO to extend `TunablesSchema` with a `zones` block. | P2 |
| 14 | `src/game/obstacles/obstacleSpawner.ts:75` | `laneCenterAt` stub returns flat-track math; real trackComposer exists at `src/track/trackComposer.ts` but isn't wired in. Bug: obstacles on curves will spawn in wrong world-space. | **P0** |
| 15 | `src/render/obstacles/*.tsx` (8 files) | "TODO(gameState)" and "TODO(assets)" stickers. `gameState` is actually ported now — the stickers are stale, not broken, but they're noise that'll confuse readers. | P2 |

Recommended: a single P1 sweep to (a) delete stale `TODO(gameState)` stickers now that the shim exists, (b) land Task #124 (tunables rollout), (c) land Task #125 (tireSqueal subscribe), (d) fix `laneCenterAt` to use real `trackComposer`.

### 1.5 Files over the 300-LOC soft signal

| # | File | LOC | Verdict |
|---|------|-----|---------|
| 16 | `src/game/gameState.ts` | 788 | **Refactor.** Genuinely tangled: snapshot/getter (130) + ensureGameTraits (60) + resetAllTraits (50) + 15 setter functions (150) + useGameStore shim + useSyncExternalStore plumbing (250) + RAF polling subscription (40). Five responsibilities stacked. Split into: `gameStateSnapshot.ts`, `gameStateTraits.ts` (ensure/reset), `gameStateMutators.ts` (setters), `gameStateSubscription.ts` (shim + useSyncExternalStore). |
| 17 | `src/render/Track.tsx` | 402 | Single responsibility (procedural track geometry). Mostly a vertex-buffer builder. Soft signal only — *acceptable once `sampleStation` + `buildTrackGeometry` are extracted* (finding #10). |
| 18 | `src/game/obstacles/useObstacleFrame.ts` | 315 | Per-frame system. Soft signal only — extract critter-flee logic (~40 lines) if it grows. |
| 19 | `src/config/shopCatalog.ts` | 296 | Data catalog. **Acceptable** — exactly the "generated schema" carve-out. |

Priorities: 16=**P1 medium, specialist agent**. 17-19 acceptable.

### 1.6 Silent fallbacks that violate rule #4 ("hard-fail, no fallbacks")

Scanned `?? ` and `.catch(()`: 160+ uses, mostly legitimate default-value coalescing (e.g. `row?.unlockedAt ?? null` to normalize SQL NULL). Problematic patterns:

| # | File:line | Issue | Recommended fix | Priority | Effort |
|---|-----------|-------|-----------------|----------|--------|
| 20 | `src/hooks/useLoadout.ts:67, 91` | `prefSetJSON(...).catch(() => {})` — loadout writes silently fail. If Preferences plugin throws, player thinks their loadout is saved. Rule #4 violation. | Route to `reportError(err, 'useLoadout.save')`. | **P0** | trivial | self |
| 21 | `src/ui/panels/TicketShop.tsx:83` | `hasUnlock(...).catch(() => false)` — DB read error is silently reported as "not owned", letting the player re-buy what they already own. | Let error propagate to `ErrorModal`. | **P0** | trivial | self |
| 22 | `src/audio/useArcadeAudio.ts:36` | `.catch(() => {…})` on audio start (understandable — browser autoplay policy). | **Acceptable.** Autoplay-rejection is a known browser-gesture constraint, not a bug. Document with a comment that explicitly refs the autoplay rule. | P2 | trivial | self |
| 23 | `src/hooks/usePrefersReducedMotion.ts:52` | `.catch(() => {})` on preference load. | Route to `reportError` — same rationale as #20. | P1 | trivial | self |
| 24 | `src/persistence/dbDrivers.ts:166-171` | `r.changes?.values ?? []` and `rows[0] ?? []` — SQL-result optional chaining fallbacks. In theory sqlite result rows can legitimately be undefined for UPDATE statements. | **Acceptable** after a one-line comment explaining why this is driver-shape normalization, not a fallback. | P2 | trivial | self |

### 1.7 `.skip()` / `.todo()` tests

| # | File:line | Issue | Priority |
|---|-----------|-------|----------|
| 25 | `e2e/determinism.spec.ts:16` | Skipped on `mobile-portrait` for "timing too jittery". Acceptable — mobile emulator timing is genuinely noisy. Keep. | P2 |
| 26 | `e2e/mobile-gameplay.spec.ts:19,27,46,55` | Four `.skip()` calls are project-guards (mobile-only tests skipped when not on mobile-portrait project). These are not actually-disabled tests. Keep. | — |

No `.todo()` tests found. No tests worth reviving.

---

## Track 2 — Architecture compliance

### 2.1 Logic/render/data separation (rule #1)

| Check | Result |
|-------|--------|
| `.tsx` contains pure-render math only | **Partial.** See findings #9-11. Verdict: mostly compliant; `PlayerCar.tsx` and `Track.tsx`'s `sampleStation` are the two real violations. |
| `.ts` contains no magic numbers | **Not compliant.** See findings #4-5 (constants.ts + obstacleSpawner.ts), #14. Task #124 is the rollup fix. |
| `.json` is the data source | Compliant for what's already in `tunables.json` + `archetypes/`. Zod validates on load (`src/config/index.ts:12-13`) — hard-fails on malformed JSON, which is rule #4-compliant. |

### 2.2 Koota ECS boundary (rule #2)

| Check | Result |
|-------|--------|
| No zustand dependency | **Compliant.** `node_modules/zustand` does not exist. `package.json` does not list it. |
| No remnant `create()` store calls | **Compliant.** Grep confirms zero `create((set` or `import.*zustand` anywhere. |
| `useGameStore` is ECS-backed | **Compliant.** `src/game/gameState.ts:612-641` implements a `useSyncExternalStore`-based shim over koota traits. Preserves the old zustand selector API so ~20 call sites don't need rewriting — a reasonable tactical choice. |
| `.tsx` state reads go through queries | **Mixed.** `PostFX.tsx`, `WorldScroller.tsx`, `CameraRig.tsx`, `CockpitCamera.tsx`, `ZoneProps.tsx`, `SpeedFX.tsx`, `ExplosionFX.tsx`, `ObstacleSystem.tsx`, `PlayerCar.tsx`, `MirrorLayer.tsx`, `RaidLayer.tsx`, `RacingLineGhost.tsx`, `FinishBanner.tsx` all call `useGameStore.getState()` inside `useFrame`. This is technically the shim reading traits, so it's compliant *behaviorally*, but the pattern is "go through the hook" not "query the world directly." It works and is deterministic; the cost is an RAF-polling subscribe loop (`gameState.ts:597-610`) that runs forever even when the game is paused. |
| Shim uses `useSyncExternalStore` correctly | **Minor concern.** The RAF-polling subscribe (`subscribeToGameState`) fires even when no component is subscribed — each call to `useGameStore(selector)` starts its own RAF loop with no dedupe. At scale with many components, that's N RAF polls per frame. A single shared RAF + a Set of listeners would be cheaper. |

| # | File:line | Issue | Recommended fix | Priority | Effort | Owner |
|---|-----------|-------|-----------------|----------|--------|-------|
| 27 | `src/game/gameState.ts:597-610` | Each `useGameStore` caller spawns its own RAF polling loop. With ~15 hook consumers this is ~15 RAFs/frame. | Hoist to module scope: one shared RAF driving a `Set<Listener>`, refs bumped when any tracked field changes. | P1 | small | self |
| 28 | (many `.tsx` files) | Widespread `useGameStore.getState()` inside `useFrame`. Works, but the canonical koota idiom is `useQuery(Trait)` per component. Moving to direct queries would let koota's change-detection deduplicate naturally. | **Defer.** This is an idiomatic migration, not a correctness fix. Tackle after rule #1 tunables rollout. | P2 | large | specialist agent |

### 2.3 Bus pattern usage

| Bus | Path | Status |
|-----|------|--------|
| `errorBus` | `src/game/errorBus.ts` | **Solid.** Halts on first error, dedupes, installs `window.onerror` + `unhandledrejection` handlers. `ReactErrorBoundary.tsx:22` routes react errors in. 20 files call `reportError`. |
| `diagnosticsBus` | `src/game/diagnosticsBus.ts` | Wired. `App.tsx:58-65` plumbs hooks. Reads snapshot via shim. |
| `runRngBus` | `src/game/runRngBus.ts` | Hard-fails if read before `initRunRng` (`:40`). Good. |
| `hapticsBus` | `src/game/hapticsBus.ts` | Exists and is consumed. |
| `audioBus` / `honkBus` | `src/audio/*` | Initialized in TitleScreen via `initAudioBusSafely`. Good. |

**Finding:** bus coverage looks complete. No gaps worth a P0/P1 entry.

### 2.4 Error-modal coverage (rule #4)

- `window.onerror` + `unhandledrejection` **installed** (`errorBus.ts:122-132`).
- `ReactErrorBoundary` forwards render errors (`ui/hud/ReactErrorBoundary.tsx:22`).
- `ErrorModal` component exists at `src/ui/hud/ErrorModal.tsx` (254 LOC — reasonable, includes stack/cause/copy-to-clipboard).
- Zod validation at config load is hard-fail.
- **Gaps:** see findings #20-23 — silent `.catch(() => {})` still exists in 4 places. P0 for #20-21, P1 for #23.

### 2.5 Tunables schema completeness

Checked `src/config/schema.ts` + `tunables.json`. The schema covers: speed, combo, damage, obstacles, raid, airborne/trick (implied). **Missing blocks** (all P1):

- `track` (LANE_COUNT, LANE_WIDTH, SEGMENT_SUBDIVISIONS, SLAB_DEPTH, LANE_STRIPE_WIDTH, CURB_*).
- `honk` (SCARE_RADIUS_M, FLEE_LATERAL_M, FLEE_DURATION_S, COOLDOWN_S).
- `steer` (MAX_LATERAL_MPS, RETURN_TAU_S, WHEEL_MAX_DEG, SENSITIVITY).
- `obstacles.spawn` (minGap, jitter, pickupMinGap, pickupJitter).
- `obstacles.critterThresholds`, `obstacles.zoneWeights`.
- `cockpit.lateralLimitM`.
- `zones` (for audio conductor per TODO).

That's the Task #124 + Task #125 rollup.

---

## Track 3 — CI/CD + test infrastructure

### 3.1 Workflow order (ci → release → cd)

| File | Purpose | Compliance |
|------|---------|------------|
| `ci.yml` | `pull_request` (no branch filter) + `push: main`. Lint, typecheck, node + jsdom + browser tests, production build + bundle budget, android-smoke (Maestro), e2e (Playwright), lighthouse, frametime. | **Compliant** with governance order: gates PRs, builds artifacts, runs telemetry. |
| `release.yml` | On `release: published`. Builds + zips web bundle, assembles Android APK, attaches to release. | **Compliant.** |
| `cd.yml` | On `push: main`. release-please reconcile → GitHub Pages deploy → android-debug-apk. | **Mostly compliant.** Does a duplicated build (`deploy-web` re-runs `pnpm exec biome ci . && pnpm exec tsc --noEmit && pnpm test && pnpm build`) when `ci.yml` already ran those on the merged commit. And `cd.yml` rebuilds the APK that `ci.yml` also builds. Governance rule says cd.yml should deploy artifacts produced by release.yml, not rebuild them. |

| # | File:line | Issue | Recommended fix | Priority | Effort | Owner |
|---|-----------|-------|-----------------|----------|--------|-------|
| 29 | `.github/workflows/cd.yml:76-83` | `deploy-web` re-runs lint+typecheck+test+build. CI just did this. Slows the main-branch feedback loop by ~5 min. | Have CI upload the `dist/` artifact on `push: main`; `cd.yml` downloads it via `actions/download-artifact@v4` instead of rebuilding. | P1 | small | self |
| 30 | `.github/workflows/release.yml:8-12` + `cd.yml:15-18` | TODO comments reference `npx cap add android`, but `android/` directory exists (confirmed `ls android/`). The TODOs are stale. | Delete the stale TODOs. APK block is already live. | P1 | trivial | self |
| 31 | `.github/workflows/release.yml:74` | `./gradlew assembleRelease \|\| ./gradlew assembleDebug` — silent fallback to a debug build that gets renamed to `*-release.apk` and attached to a *release*. Violates rule #4 at the CI level. Users downloading release assets might get an unsigned debug APK with no indication. | Either require signing keys + hard-fail on missing, or always assemble debug and rename the artifact to `*-debug.apk`. Don't pretend a debug APK is a release APK. | **P0** | small | self |

### 3.2 release-please failing on main with "GitHub Actions is not permitted to create or approve pull requests"

**Root cause:** this is a repo-level / org-level GitHub setting, not a workflow bug. The workflow at `cd.yml:38-52` already sets `permissions: contents: write, pull-requests: write`, which is correct at the workflow level. The remaining block is the org/repo setting that forbids Actions from ever opening PRs regardless of workflow permissions.

**Fix (user-facing, not a code change):**
- Repo → Settings → Actions → General → "Workflow permissions" → enable **"Allow GitHub Actions to create and approve pull requests."**
- Alternative: create a fine-grained PAT or use a GitHub App token, and set `token: ${{ secrets.RELEASE_PLEASE_TOKEN }}` on the release-please-action instead of `GITHUB_TOKEN`.

| # | Action | Priority | Owner |
|---|--------|----------|-------|
| 32 | Flip repo setting "Allow GitHub Actions to create and approve pull requests" | **P0** | **self** (user-facing GitHub setting; agent cannot change it) |

### 3.3 Playwright e2e — 1hr runtime + `continue-on-error: true`

Current state: `ci.yml:241` has `continue-on-error: true` on the whole e2e-tests job. Comment explains this is intentional because vitest-browser is the authoritative gate and Playwright covers "the same surfaces" less reliably on CI runners. That's defensible; the tests exist for telemetry, not gating.

**But** — 1hr runtime is wasteful. Quick analysis of `e2e/`:

| Test file | Cost | Verdict |
|-----------|------|---------|
| `governor-playthrough.spec.ts` | 5s+3s+1.5s timeouts × 3 projects = ~30s | Keep — it's the "real playthrough" screenshot gate. |
| `visual-regression.spec.ts` | Existing PNG baselines suggest it's fast (sub-30s per project). | Keep. |
| `mobile-gameplay.spec.ts` | 4 mobile-gated tests (touch, pause, gameover, trick). | Keep, **but** split to a separate non-blocking project rather than counting toward mandatory suite. |
| `seed-playthroughs.spec.ts` | Likely the 1hr offender — multi-seed deterministic playthroughs. | Slowest-suspect. If each seed is 60s × many seeds × 3 projects, that's the hour. |
| `determinism.spec.ts` | Timing-sensitive. Skipped on mobile-portrait. | Keep. |
| `governor-playthrough.spec.ts` | Short. Keep. |

| # | Issue | Recommended fix | Priority | Effort | Owner |
|---|-------|-----------------|----------|--------|-------|
| 33 | `e2e/seed-playthroughs.spec.ts` likely dominates wall-time. | Trim to 3 representative seeds (not N). Move the full seed-matrix to a `workflow_dispatch`-only job that runs nightly / on demand. | P1 | small | specialist agent |
| 34 | `playwright.config.ts:21` caps workers at 2. | Fine for a 4-core runner. Keep. | — | — | — |
| 35 | `ci.yml:241` `continue-on-error: true` | **Acceptable** given the comment, but consider moving the whole e2e-tests job to a separate non-blocking workflow (`e2e-telemetry.yml` with `on: schedule`) so it stops inflating every PR's job count. | P2 | small | self |

### 3.4 Maestro flows — "Element not found" risk post-testid rollout

`grep -r "Element not found\|Warning: Element" maestro/` → **no matches**. The testid-ification cleaned them up.

Double-checked: `maestro/android-smoke.yaml` uses only `launchApp` + `assertVisible: '.*'` + `takeScreenshot` (no brittle selectors). Other flows (gameplay, pause-resume, ramp-trick, critter-scare, touch-steering, hud-visible, game-over, title-panels) — these need per-flow inspection but the grep is clean. **Risk is low.** Residual concern: animated testids (toast overlays that render, then unmount ~2s later) can race with `assertVisible` — but this is a timing issue, not a selector issue.

### 3.5 `@vitest/browser/context` deprecation

Six files still import `from '@vitest/browser/context'` (7 including `setup.ts`'s matchers import). Vitest 4.x marks this path deprecated in favor of `from 'vitest/browser'`.

Files using deprecated path:
- `src/render/Driving.browser.test.tsx:13`
- `src/render/TrackSegment.browser.test.tsx:17`
- `src/render/Track.browser.test.tsx:16`
- `src/render/CockpitWithTrack.browser.test.tsx:13`
- `src/render/cockpit/Cockpit.browser.test.tsx:13`
- `src/ui/TitleScreen.browser.test.tsx:10`
- `src/test/browser-commands.d.ts:15` (ambient `declare module` — needs matching path)

`src/test/harness.browser.test.tsx:13` already uses `from 'vitest/browser'` — good reference.

| # | Issue | Fix | Priority | Effort | Owner |
|---|-------|-----|----------|--------|-------|
| 36 | 6 test files + 1 d.ts on deprecated `@vitest/browser/context` import | Mechanical rename to `vitest/browser` (the `commands` export is at the same path). Touch `browser-commands.d.ts` to redeclare the same module under the new path. | P2 | trivial | **self** (mechanical find-replace) |
| 37 | `src/test/setup.ts:2` imports `'@vitest/browser/matchers'` | Confirm against Vitest 4.x docs — this path may also be renamed. Low urgency. | P2 | trivial | self |

### 3.6 Misc CI observations

| # | Issue | Recommended fix | Priority | Effort | Owner |
|---|-------|-----------------|----------|--------|-------|
| 38 | `package.json:22` `test:jsdom` is an `exit 0` stub that `ci.yml` still invokes in a dedicated job | Delete the `jsdom-tests` job in `ci.yml:54-68`. Remove the stub script. | P1 | trivial | self |
| 39 | `package.json:28-30` `audit:frametime`, `audit:lighthouse` are `exit 0` stubs. `ci.yml` has dedicated jobs that run them. | Either implement the audits or delete the CI jobs. Current state: CI wastes ~2 min on ceremonial no-ops. | P1 | small | self |
| 40 | `ci.yml:142, 241, 283, 313` — four `continue-on-error: true` telemetry jobs | Move all four (android-smoke, e2e-tests, lighthouse, frametime-audit) into a separate `ci-telemetry.yml` with `on: schedule + workflow_dispatch` so PRs don't spawn dead jobs. | P2 | medium | specialist agent |

---

## Special call-out: "hard-fail, no fallbacks" violations

Rule #4 is the project's architectural backbone. Violations found:

1. **#20** `useLoadout.ts:67, 91` — `.catch(() => {})` on preference writes. P0.
2. **#21** `TicketShop.tsx:83` — `.catch(() => false)` masks DB read errors as "not owned." P0.
3. **#23** `usePrefersReducedMotion.ts:52` — silent preference-load catch. P1.
4. **#14** `obstacleSpawner.ts:77` — `laneCenterAt` stub silently returns flat-track geometry on curves. P0 (silent wrong-answer, not a thrown error, but semantically the same violation).
5. **#31** `release.yml:74` — `assembleRelease || assembleDebug` silently downgrades release artifacts. P0.
6. **#8** `TrackContent.tsx:187` — unreachable `??` fallback is noise, not a violation. P2.

Fix list for rule #4 compliance: #20, #21, #14, #31 as P0 blockers.

---

## Summary table — do-it-yourself vs dispatch-an-agent

| Self (quick wins) | Specialist agent (medium+) |
|-------------------|----------------------------|
| #1 delete `ui/TitleScreen.tsx` (trivial) | #3 migrate `storage/scores.ts` to persistence stack (medium) |
| #2 consolidate `GameOverOverlay` (small) | #4 + #5 tunables rollout Task #124 (medium, JSON+zod+callsite sweep) |
| #7 `lateralLimit` → tunable (trivial) | #9 move PlayerCar frame logic to ECS system (medium) |
| #20 #21 #23 `.catch` → `reportError` (trivial each) | #10 extract `sampleStation`/`buildTrackGeometry` to `track/trackGeometry.ts` (medium) |
| #27 single RAF for useGameStore shim (small) | #14 wire `laneCenterAt` to `trackComposer` (medium — needs gameplay verification) |
| #29 cd.yml artifact reuse (small) | #16 split `gameState.ts` 788→4 files (medium) |
| #30 delete stale workflow TODOs (trivial) | #28 migrate `.tsx` getState calls to direct koota queries (large, ~15 files) |
| #31 fix `release.yml` APK fallback (small, **P0**) | #33 trim seed-playthroughs (small) |
| #32 flip repo GitHub Actions setting (trivial, **P0 user-facing**) | #40 split telemetry jobs to scheduled workflow (medium) |
| #36 `@vitest/browser/context` → `vitest/browser` rename (trivial) | |
| #38 delete stub `test:jsdom` + ci job (trivial) | |
| #39 delete or implement `audit:frametime` / `audit:lighthouse` (small) | |

---

## Open questions

1. Does `audit:lighthouse` actually belong in CI, or is it deploy-URL-only telemetry? Decide then either implement against preview URL or delete.
2. Is the `useGameStore` shim a transitional layer (planned to delete once callsites migrate to direct koota queries) or a permanent API? Decide — affects whether #28 is a real task.
3. Should `src/ui/TitleScreen.tsx` + `src/ui/GameOverOverlay.tsx` be kept as legacy fallbacks or deleted? Recommended: delete — v2 rule is "no fallbacks."
