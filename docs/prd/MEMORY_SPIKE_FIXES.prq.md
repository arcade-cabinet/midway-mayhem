---
title: Memory Spike Fixes — PRQ
updated: 2026-04-24
status: current
domain: context
---

# Memory Spike Fixes

## Priority: CRITICAL — BLOCKS ALL PLAYWRIGHT / BROWSER TESTS

A Playwright real-GPU session against this repo caused a massive host-memory
spike that forced a system restart. Before a single browser test is run
again, every finding below must be fixed and verified by `pnpm lint`,
`pnpm typecheck`, and `pnpm test:node`. **No `pnpm test:browser`, no
`pnpm dev`, no Playwright, no Chrome automation is permitted until every
P1 item below is closed.**

Root cause, in one sentence: the combination of (a) an unbounded 3-second
snapshot loop that pinned PNG Buffers in page memory, (b) a game loop that
never called `endRun()` so the ECS sim ticked forever past the finish line,
and (c) N independent RAF loops — one per `useGameStore` subscriber —
amplified every leak. PR #308 already shipped two targeted fixes (the
`endRun()` call after game-over; the lazy spessasynth import). Everything
else below remains.

## Methodology

1. **Doc → failing test → code**, same pattern as A-DESC-1.
2. Each task ships in its own PR with conventional-commits title.
3. CI must go green before merge — Node Tests, Lint, Type Check, Browser
   Smoke, Browser Snapshot, Build, E2E Android Smoke.
4. `pnpm test:browser` and `pnpm dev` remain banned for the human operator
   while this PRQ is in flight; CI is free to run them because each CI
   shard is a fresh ephemeral VM.
5. A task is not done until its verification checklist is visibly green
   in the PR.

---

## Track M — memory + loop hazards (P1)

### M-SPEC-SNAP P1 — Periodic-snapshot spec must not accumulate screenshots or leak the page
- **Doc:** `docs/TESTING.md` — add a "Long-running spec budget" section:
  specs that loop for > 30s must (i) stream screenshots straight to disk
  with `page.screenshot({ path })` never holding the Buffer, (ii) wrap the
  loop in `try/finally` that calls `page.close()` + `context.close()`,
  (iii) hard-cap both wall-clock AND iteration count independent of each
  other.
- **Test:** `e2e/__tests__/run-snapshots.static.test.ts` (Node vitest) —
  static assertion that `e2e/run-snapshots.spec.ts` contains:
  - the literal string `finally {` followed by `page.close`
  - the regex `for \(let i = 0; i < \d+; i\+\+\)` (bounded loop, no `for(;;)`)
  - NO occurrences of `const .* = await page\.screenshot\({[^}]*type:[^}]*}\);`
    in the snapshot helper (screenshots must use the `path:` form)
- **Code:** Rewrite `e2e/run-snapshots.spec.ts` helper `snap()` to take a
  path and write via `page.screenshot({ path, type: 'png' })` — never
  capture the Buffer. Delete the `testInfo.attach({ body: shot })` call;
  attach via `{ path }` instead. Wrap the main test body in
  `try { ... } finally { await page.close(); }`. Replace `for (;;)` with
  `const MAX_ITERATIONS = Math.ceil(MAX_WALL_CLOCK_MS / SNAPSHOT_INTERVAL_MS) + 2;
  for (let i = 0; i < MAX_ITERATIONS; i++)`.
- **Acceptance:** Static test green. Heap snapshot during the spec (CI)
  grows linearly by ≤ 5 MB per snapshot tick (down from ~50 MB+).

### M-SPEC-SOAK P1 — stability-soak spec must not accumulate heartbeat metadata
- **Doc:** Note in `docs/TESTING.md` under the same section: long soak specs
  keep only the MOST RECENT heartbeat in memory, plus counts, never the
  full history.
- **Test:** `e2e/__tests__/stability-soak.static.test.ts` — static check
  that `e2e/stability-soak.spec.ts` does NOT accumulate an array of objects
  keyed `heartbeats` with a `.push(` inside the loop.
- **Code:** In `e2e/stability-soak.spec.ts`, replace the `heartbeats: HB[]`
  accumulator with a single `lastHeartbeat: HB | null` plus a counter
  `heartbeatsSeen: number`. Write each PNG to disk with `{ path }`, attach
  with `{ path }`. Add `try/finally { await context.close(); }`.
- **Acceptance:** Static test green. Memory profile (CI smoke) shows the
  heartbeats array no longer exists.

### M-SPEC-SEED P1 — seed-playthroughs factory frame accumulator must be bounded
- **Doc:** Extend the same TESTING.md section — factories that build
  frame dumps must drop non-final frames after writing them to disk.
- **Test:** `e2e/__tests__/seed-playthroughs.static.test.ts` — asserts
  `e2e/_factory.ts` helper loop references `path:` on every
  `page.screenshot` call and retains only summary metadata between
  iterations (no `frames.push(diag)` with a full `diag` payload).
- **Code:** `e2e/_factory.ts` — change `frames.push({ frame, elapsedMs, diag, screenshotPath })`
  to `frames.push({ frame, elapsedMs, screenshotPath })`. Diags go to disk
  next to the PNG, not into the JS heap. Replace early-exit regex check
  with a hard `maxFrames` cap AND a hard `maxWallClockMs` cap, whichever
  hits first.
- **Acceptance:** Static test green.

### M-SPEC-GOV P1 — playthrough-governor must always close the browser
- **Doc:** `scripts/playthrough-governor.ts` — add a top-of-file comment
  describing the SIGINT/SIGTERM + try/finally lifecycle.
- **Test:** `scripts/__tests__/playthrough-governor.static.test.ts` —
  asserts the file contains both a `process.on('SIGINT'` and a
  `try { ... } finally { ... await browser.close()`.
- **Code:** Wrap the main body of `scripts/playthrough-governor.ts` in
  `try/finally`. Add `process.on('SIGINT', async () => { await browser.close().catch(() => {}); process.exit(130); })`
  and same for `SIGTERM`. If `browser` variable is not yet assigned when
  signal fires, guard with `browser?.close`.
- **Acceptance:** Static test green; killing the script with Ctrl+C during
  a session leaves no orphan Chrome process (manual verification — can be
  done without re-running the full suite).

### M-SPEC-CONFIG P1 — Playwright retention defaults must not bloat disk/memory
- **Doc:** Update `docs/TESTING.md` — explain why we run without traces +
  videos outside of a `DEBUG_TRACES=1` environment variable.
- **Test:** `playwright.config.ts` is checked via a unit test at
  `scripts/__tests__/playwright-config.static.test.ts` that asserts:
  - `trace === 'off'` unless `process.env.DEBUG_TRACES`
  - `video === 'off'` unless `process.env.DEBUG_TRACES`
  - `workers` is an explicit integer, not undefined
- **Code:** Edit `playwright.config.ts` to gate `trace`/`video` behind
  `process.env.DEBUG_TRACES === '1'`, defaulting to `'off'` otherwise.
  Add explicit `workers: process.env.CI ? 2 : 1`.
- **Acceptance:** Static test green. CI disk usage after a full e2e run
  drops by ≥ 70%.

### M-RAF-SHIM P1 — subscribeToGameState must use ONE shared RAF, not one per subscriber
- **Doc:** `docs/ARCHITECTURE.md` — add a "Store subscription model" subsection
  describing the single-RAF-per-world invariant and why (N-RAF amplifies
  every downstream leak).
- **Test:** `src/game/__tests__/gameStateShim.test.ts` — asserts that after
  10 concurrent `subscribeToGameState` calls, `globalThis.requestAnimationFrame`
  has been called exactly 1 time (mocked with a spy), not 10.
- **Code:** `src/game/gameStateShim.ts` — refactor to:
  - Module-level `let listeners = new Set<() => void>()`.
  - Module-level `let rafId = 0; let running = false;`.
  - `subscribeToGameState(listener)` adds to the Set, starts the loop if
    `!running`, and returns an unsubscribe that removes from the Set and
    stops the loop when the Set is empty.
  - Single shared `tick()` reads world state once, then notifies all
    listeners.
- **Acceptance:** Node test green. Typecheck clean.

### M-RAF-GIMMICK P1 — useGameSystems gimmick loop must not double-schedule under StrictMode
- **Doc:** No doc change required.
- **Test:** `src/game/__tests__/useGameSystems.test.ts` — renders the hook
  with React Testing Library's StrictMode wrapper, waits one animation
  frame, then checks that `requestAnimationFrame` has been invoked
  exactly once (via `vi.spyOn`).
- **Code:** `src/game/useGameSystems.ts` — guard the loop with an `alive`
  flag captured inside the effect; set `alive = false` in cleanup AND call
  `cancelAnimationFrame(rafId)` using the latest `rafId` reference.
  Refactor `gimmickLoop` to check `if (!alive) return;` before scheduling
  the next frame.
- **Acceptance:** Node test green.

### M-SYNC-POLL P1 — gameStateShim must not call poll() synchronously before the RAF is scheduled
- **Doc:** No doc change required.
- **Test:** `src/game/__tests__/gameStateShim.test.ts` — asserts that a
  newly-created subscription does NOT invoke its listener synchronously
  during subscribe.
- **Code:** In `src/game/gameStateShim.ts` poll helper, remove the eager
  `poll()` call. Start with `rafId = requestAnimationFrame(tick)` only.
- **Acceptance:** Node test green.

### M-AUDIO-TRANSPORT P1 — one owner for Tone.Transport start/stop
- **Doc:** `docs/ARCHITECTURE.md` audio section — document that
  `conductor` is the sole owner of `Tone.Transport` lifecycle, and
  `arcadeAudio` uses `Tone.getContext().resume()` only.
- **Test:** `src/audio/__tests__/transport-ownership.test.ts` — mock Tone,
  drive both `conductor.start()`/`stop()` and `arcadeAudio.setMusicPlaying(true/false)`,
  assert `Tone.Transport.start` and `Tone.Transport.stop` are only called
  from `conductor`.
- **Code:** Strip the `Tone.Transport.start()`/`stop()` calls from
  `src/audio/arcadeAudio.ts`; replace with `Tone.getContext().resume()`.
- **Acceptance:** Node test green. Audio E2E still green.

### M-ECS-GAMEOVER P1 — startRun() must reset the module-level gameOver flag
- **Doc:** Inline comment in `gameOver.ts` explaining the invariant.
- **Test:** `src/ecs/systems/__tests__/gameOver.test.ts` — drives a world
  through `stepGameOver` (ended=true), then calls `startRun()`, then asserts
  that `stepGameOver` will fire `onEnd` again for a fresh game-over
  trigger.
- **Code:** In `src/game/gameState.ts` `startRun()`, add a call to
  `resetGameOver()` (imported from `@/ecs/systems/gameOver`).
- **Acceptance:** Node test green.

### M-OPFS-INFLIGHT P1 — persistToOpfs must serialize writes
- **Doc:** Inline comment in `src/persistence/db.ts` explaining the
  in-flight chain.
- **Test:** `src/persistence/__tests__/persistToOpfs.test.ts` — mock
  `FileSystemFileHandle.createWritable` with a stall, fire two
  `persistToOpfs()` calls in quick succession, assert only one write is
  in flight at a time.
- **Code:** Add a module-level `_opfsWriteInFlight: Promise<void> | null`
  and chain via `_opfsWriteInFlight = (_opfsWriteInFlight ?? Promise.resolve()).then(...)`.
- **Acceptance:** Node test green.

### M-APP-AUDIOBRIDGE P2 — AudioBridge.onReady must fire from an effect
- **Doc:** No doc change required.
- **Test:** `src/app/__tests__/AudioBridge.test.tsx` — renders `<AudioBridge
  onReady={spy} />` in StrictMode, asserts `spy` is called after mount,
  not during render.
- **Code:** In `src/app/App.tsx`, move `onReady(api)` inside a
  `useEffect(() => { onReady(api); }, [api, onReady])` block.
- **Acceptance:** Node test green.

---

## Track P — performance audit follow-ups (P2)

The performance-optimizer agent was rate-limited during the audit sweep.
Before the P2 bundle lands, dispatch a fresh agent to scan for:

- useFrame allocations (Vector3 / Quaternion / Euler / Matrix4 / Color)
  created inside tick bodies in `src/render/**` and `src/ecs/systems/**`.
- Three.js geometry/material/texture resources missing dispose paths in
  the same directories.
- Tone.js nodes created per event (zone change, honk, scare) without a
  cleanup path in `src/audio/**`.
- Unbounded buffers in `src/game/ghost.ts`, `src/persistence/replay*`.
- Track generator allocations per tick in `src/track/**` or
  `src/ecs/systems/track.ts`.
- Zone-specific allocators that could be the balloon-alley stall trigger
  around distance 690–800m.

Each finding becomes its own child task (P-ALLOC-<short-name>) with the
same doc → test → code → acceptance shape as Track M.

---

## Verification gate (BEFORE ANY BROWSER TEST RESUMES)

1. All Track M tasks merged, status current on `main`.
2. `pnpm lint && pnpm typecheck && pnpm test:node` green locally (no
   browser tests yet — still banned for the operator until this PRQ
   closes).
3. CI run on `main` shows full rollup green including Browser Snapshot
   and Node Tests.
4. Manual sanity: run `scripts/playthrough-governor.ts` with `--max-frames 3`
   in a local shell (single short run, not a suite), verify no orphan
   Chrome processes after exit via `pgrep -lf chromium | wc -l`. If that
   passes, the browser-test ban is lifted.

Until step 4 passes, DO NOT RUN Playwright. DO NOT RUN `pnpm test:browser`.
DO NOT RUN `pnpm dev`. The only things the operator should run are static
checks + Node tests.
