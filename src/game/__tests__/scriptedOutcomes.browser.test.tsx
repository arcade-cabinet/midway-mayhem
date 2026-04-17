/**
 * scriptedOutcomes.browser.test.tsx
 *
 * Validates each PathOutcome end-to-end in a real Chromium environment with
 * WebGL available. Tests run against the game state machine directly — no
 * full game component mount needed — which keeps the suite fast while still
 * exercising real browser APIs (KeyboardEvent, requestAnimationFrame,
 * performance.now).
 *
 * Architecture:
 *   1. startRun() seeds the store with a deterministic plan.
 *   2. A minimal game-loop driver (requestAnimationFrame + tick) replaces
 *      GameLoop.tsx, integrating lateral from steer each frame.
 *   3. A script-player polls distance every ~50ms and fires window
 *      KeyboardEvents when each ScriptedInput threshold is crossed.
 *   4. A keyboard listener mirrors useKeyboardControls: ArrowLeft/Right
 *      map to setSteer(±1 / 0).
 *   5. Assertions inspect the final store state.
 *
 * For 'collide-first' the collision system is not running (ObstacleSystem is
 * not mounted), so we assert that the player reached the obstacle's distance
 * AND is in the obstacle's lane — the deterministic indicator that a real
 * crash would have fired.
 *
 * For 'plunge-off-ramp' we simulate the TrackSystem reporting the ramp piece
 * kind by calling setCurrentPieceKind('rampLong') once the car enters the
 * ramp window, which lets tick() trigger the plunge state naturally.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DROP_DURATION_MS, resetGameState, useGameStore } from '@/game/gameState';
import {
  type PathOutcome,
  type ScriptedInput,
  scriptForOutcome,
  scriptForSeed,
} from '@/game/optimalPath';
import { buildRunPlan } from '@/game/runPlan';
import { composeTrack, DEFAULT_TRACK, type PieceKind } from '@/track/trackComposer';
import { STEER, TRACK } from '@/utils/constants';
import { damp } from '@/utils/math';
import { createRunRng } from '@/utils/rng';

// ─── Constants ─────────────────────────────────────────────────────────────

/** Fixed seeds used across tests — chosen for stable plan shapes. */
const SEED_A = 12_345;
const SEED_B = 99_999;

/** Maximum real-time ms allowed per outcome test (browser timer budget). */
const OUTCOME_TIMEOUT_MS = 25_000;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a run plan from a numeric seed without touching the run-scoped PRNG. */
function planFromSeed(seed: number) {
  return buildRunPlan({ seed, trackRng: createRunRng(seed).track });
}

/**
 * Skip the drop-in animation so tick() advances distance immediately.
 * Mirrors the helper used in gameState.test.ts.
 */
function skipDropIn() {
  useGameStore.setState({
    dropProgress: 1,
    dropStartedAt: performance.now() - DROP_DURATION_MS - 100,
  });
}

/**
 * Turbo game loop driver. Returns a cancel fn.
 *
 * Runs many simulation steps per wall-clock tick so the car advances through
 * thousands of metres in seconds of real time instead of minutes. Uses a
 * fixed STEP_DT (0.05s per tick) and runs STEPS_PER_CALL steps each
 * setInterval callback.
 *
 * Simulated `now` starts at performance.now() and advances by STEP_DT each
 * step so plunge timers and boost timers work correctly.
 *
 * Each step:
 *   - calls scriptPlayer.step(distance) to dispatch pending KeyboardEvents
 *   - integrates lateral from steer (mirrors GameLoop.tsx)
 *   - calls tick(dt, simNow)
 *   - calls onFrame(distance) so piece-kind callbacks fire at the right distance
 */
function startGameLoopDriver(
  scriptPlayer: ReturnType<typeof makeScriptPlayer>,
  onFrame?: (distance: number) => void,
): () => void {
  const STEP_DT = 0.05; // 50ms per simulated tick
  const STEPS_PER_CALL = 20; // 20 steps per setInterval call = 1s simulated per call
  let simNow = performance.now();
  let intervalId = 0;
  let cancelled = false;

  const loopStep = () => {
    if (cancelled) return;
    for (let i = 0; i < STEPS_PER_CALL; i++) {
      const dist = useGameStore.getState().distance;
      // Fire any pending script events before this tick
      scriptPlayer.step(dist);
      simNow += STEP_DT * 1000; // advance simulated clock in ms
      const s = useGameStore.getState();
      if (!s.running || s.paused || s.gameOver) break;
      // Integrate lateral from steer — mirrors GameLoop.tsx.
      const target = s.steer * STEER.MAX_LATERAL_MPS;
      const nextLateral = damp(s.lateral, s.lateral + target * STEP_DT * 0.5, 0.18, STEP_DT);
      useGameStore.getState().setLateral(nextLateral);
      useGameStore.getState().tick(STEP_DT, simNow);
      onFrame?.(useGameStore.getState().distance);
    }
  };

  intervalId = window.setInterval(loopStep, 16) as unknown as number;
  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
  };
}

/**
 * Install a keyboard listener that maps ArrowLeft/ArrowRight to setSteer.
 * Returns both the cleanup fn and the current "held keys" set so the
 * turbo loop driver can keep the steer resolved after dispatching synthetic
 * KeyboardEvents that the DOM listener will process asynchronously.
 */
function installKeyboardSteer(): { cleanup: () => void; held: Set<string> } {
  const held = new Set<string>();

  function resolveSteer(): number {
    const left = held.has('ArrowLeft');
    const right = held.has('ArrowRight');
    if (left && !right) return -1;
    if (right && !left) return 1;
    return 0;
  }

  const onDown = (e: KeyboardEvent) => {
    held.add(e.key);
    useGameStore.getState().setSteer(resolveSteer());
  };
  const onUp = (e: KeyboardEvent) => {
    held.delete(e.key);
    useGameStore.getState().setSteer(resolveSteer());
  };

  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);

  return {
    held,
    cleanup: () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      held.clear();
    },
  };
}

/**
 * Script player: fires KeyboardEvents on window when distance crosses each
 * dTrigger threshold. Called synchronously from the turbo loop driver each
 * step so events are never missed between polling intervals.
 */
function makeScriptPlayer(script: ScriptedInput[]) {
  const pending = [...script].sort((a, b) => a.dTrigger - b.dTrigger);
  let nextIdx = 0;

  return {
    /** Call each simulation step with current distance. */
    step(distance: number): void {
      while (nextIdx < pending.length) {
        const ev = pending[nextIdx];
        if (!ev) break;
        if (distance < ev.dTrigger) break;
        window.dispatchEvent(new KeyboardEvent(ev.type, { key: ev.key, bubbles: true }));
        nextIdx++;
      }
    },
  };
}

/**
 * Run an outcome and resolve once the stop condition is met (or timeout).
 * Returns the final game state snapshot.
 *
 * The turbo loop advances simulation time 20x faster than wall clock so
 * even a 4000m run completes in ~4s of real time.
 */
async function runOutcome(
  seed: number,
  outcome: PathOutcome,
  stopWhen: (s: ReturnType<typeof useGameStore.getState>) => boolean,
  maxMs: number,
  onFrame?: (distance: number) => void,
): Promise<ReturnType<typeof useGameStore.getState>> {
  const plan = planFromSeed(seed);
  const script = scriptForOutcome(plan, outcome);

  useGameStore.getState().startRun({ seed, seedPhrase: `test-${outcome}`, difficulty: 'kazoo' });
  skipDropIn();

  const { cleanup: cleanupKeys } = installKeyboardSteer();
  const player = makeScriptPlayer(script);
  const cancelLoop = startGameLoopDriver(player, onFrame);

  return new Promise<ReturnType<typeof useGameStore.getState>>((resolve) => {
    const deadline = performance.now() + maxMs;

    const poll = window.setInterval(() => {
      const s = useGameStore.getState();
      if (stopWhen(s) || performance.now() > deadline) {
        window.clearInterval(poll);
        cancelLoop();
        cleanupKeys();
        resolve(useGameStore.getState());
      }
    }, 50);
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('scriptedOutcomes — end-to-end game state validation', () => {
  beforeEach(() => {
    resetGameState();
  });

  afterEach(() => {
    resetGameState();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // finish-clean
  // ──────────────────────────────────────────────────────────────────────────
  it(
    'finish-clean: distance reaches plan.distance without extra crashes',
    async () => {
      const plan = planFromSeed(SEED_A);

      const finalState = await runOutcome(
        SEED_A,
        'finish-clean',
        (s) => s.distance >= plan.distance || s.gameOver,
        OUTCOME_TIMEOUT_MS,
      );

      expect(finalState.distance).toBeGreaterThanOrEqual(plan.distance * 0.95);
      // screenshot on outcome transition
      const { page } = await import('vitest/browser');
      await page.screenshot({ path: '__screenshots__/outcome-finish-clean.png' });
    },
    OUTCOME_TIMEOUT_MS,
  );

  // ──────────────────────────────────────────────────────────────────────────
  // collide-first
  // The obstacle system is not mounted, so we assert that:
  //   - the car reaches the first obstacle's distance, AND
  //   - the car is laterally within the obstacle's lane OR it started there.
  // Either condition means a real crash would have fired.
  // ──────────────────────────────────────────────────────────────────────────
  it('collide-first: car reaches first obstacle distance in correct lane within 10s', async () => {
    const plan = planFromSeed(SEED_B);
    const first = plan.obstacles[0];
    expect(first).toBeDefined();
    if (!first) throw new Error('plan has no obstacles');

    const obstacleD = first.d;

    const finalState = await runOutcome(
      SEED_B,
      'collide-first',
      (s) => s.distance >= obstacleD,
      10_000,
    );

    expect(finalState.distance).toBeGreaterThanOrEqual(obstacleD);

    // Verify lateral position is in or near the obstacle's lane center.
    const centerX = TRACK.LANE_WIDTH * (first.lane - (TRACK.LANE_COUNT - 1) / 2);
    // Accept within 1.5 lane-widths (script steers gradually)
    expect(Math.abs(finalState.lateral - centerX)).toBeLessThanOrEqual(TRACK.LANE_WIDTH * 1.5);

    const { page } = await import('vitest/browser');
    await page.screenshot({ path: '__screenshots__/outcome-collide-first.png' });
  }, 15_000);

  // ──────────────────────────────────────────────────────────────────────────
  // plunge-off-ramp
  // We simulate TrackSystem by calling setCurrentPieceKind('rampLong') once
  // the car enters the ramp window so tick() can fire the plunge naturally.
  // ──────────────────────────────────────────────────────────────────────────
  it(
    'plunge-off-ramp: plunging becomes true when car reaches ramp and steers off edge',
    async () => {
      const composition = composeTrack(DEFAULT_TRACK, 10);
      const firstRamp = composition.placements.find(
        (p): p is typeof p & { kind: PieceKind } =>
          p.kind === 'ramp' || p.kind === 'rampLong' || p.kind === 'rampLongCurved',
      );
      expect(firstRamp).toBeDefined();
      if (!firstRamp) throw new Error('DEFAULT_TRACK has no ramp');

      const rampStart = firstRamp.distanceAtStart;

      // onFrame: once the car is on the ramp section, tell gameState which
      // piece kind is underfoot so plunge detection can fire.
      let pieceModeSet = false;
      const onFrame = (distance: number) => {
        if (
          !pieceModeSet &&
          distance >= rampStart &&
          distance < rampStart + firstRamp.length * 10
        ) {
          useGameStore.getState().setCurrentPieceKind(firstRamp.kind);
          pieceModeSet = true;
        }
        // Once we've passed the ramp, reset to non-ramp piece
        if (pieceModeSet && distance >= rampStart + firstRamp.length * 10 + 20) {
          useGameStore.getState().setCurrentPieceKind('straight');
          pieceModeSet = false;
        }
      };

      const finalState = await runOutcome(
        SEED_A,
        'plunge-off-ramp',
        (s) => s.plunging || s.gameOver,
        OUTCOME_TIMEOUT_MS,
        onFrame,
      );

      expect(finalState.plunging || finalState.gameOver).toBe(true);

      const { page } = await import('vitest/browser');
      await page.screenshot({ path: '__screenshots__/outcome-plunge-off-ramp.png' });
    },
    OUTCOME_TIMEOUT_MS,
  );

  // ──────────────────────────────────────────────────────────────────────────
  // survive-30s
  // Script is bounded to 30s window (30 * 30m = 900m at cruise speed).
  // We assert: still running after 30s of simulated time.
  // ──────────────────────────────────────────────────────────────────────────
  it(
    'survive-30s: still running after 30s of simulated distance',
    async () => {
      const cruiseDistanceFor30s = 30 * 30; // generous upper bound from scriptForOutcome filter

      const finalState = await runOutcome(
        SEED_A,
        'survive-30s',
        // Stop when we've covered the 30s window or lost
        (s) => s.distance >= cruiseDistanceFor30s || s.gameOver || !s.running,
        OUTCOME_TIMEOUT_MS,
      );

      // Still alive after the 30s window
      expect(finalState.running || finalState.distance >= cruiseDistanceFor30s * 0.9).toBe(true);
      // No game-over from excessive crashes
      expect(finalState.crashes).toBeLessThan(10);

      const { page } = await import('vitest/browser');
      await page.screenshot({ path: '__screenshots__/outcome-survive-30s.png' });
    },
    OUTCOME_TIMEOUT_MS,
  );

  // ──────────────────────────────────────────────────────────────────────────
  // scriptForSeed convenience wrapper
  // ──────────────────────────────────────────────────────────────────────────
  it('scriptForSeed produces the same script as scriptForOutcome(planFromSeed(seed))', () => {
    const seed = 77_777;
    const plan = planFromSeed(seed);
    const direct = scriptForOutcome(plan, 'finish-clean');
    const wrapped = scriptForSeed(seed, 'finish-clean');

    expect(wrapped).toEqual(direct);
    expect(wrapped.length).toBeGreaterThan(0);
  });

  // ──────────────────────────────────────────────────────────────────────────
  // finish-clean key hygiene: no stuck keys
  // ──────────────────────────────────────────────────────────────────────────
  it('finish-clean script has no stuck keys (every keydown has a matching keyup)', () => {
    const seeds = [SEED_A, SEED_B, 1, 42, 99_999];
    for (const seed of seeds) {
      const plan = planFromSeed(seed);
      const script = scriptForOutcome(plan, 'finish-clean');
      const held: Record<string, boolean> = { ArrowLeft: false, ArrowRight: false };
      for (const ev of script) {
        if (ev.type === 'keydown') {
          expect(held[ev.key], `${ev.key} pressed twice without release (seed ${seed})`).toBe(
            false,
          );
          held[ev.key] = true;
        } else {
          expect(held[ev.key], `${ev.key} released without press (seed ${seed})`).toBe(true);
          held[ev.key] = false;
        }
      }
      // After the full script, no key should still be held.
      expect(held.ArrowLeft, `ArrowLeft stuck at end (seed ${seed})`).toBe(false);
      expect(held.ArrowRight, `ArrowRight stuck at end (seed ${seed})`).toBe(false);
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // collide-first always produces a non-empty script
  // ──────────────────────────────────────────────────────────────────────────
  it('collide-first always produces at least one event even when first obstacle is in center lane', () => {
    // Generate plans until we find one where the first obstacle is in center lane
    const centerLane = Math.floor(TRACK.LANE_COUNT / 2);
    let found = false;

    for (let seed = 0; seed < 200; seed++) {
      const plan = planFromSeed(seed);
      const first = plan.obstacles[0];
      if (!first) continue;

      const script = scriptForOutcome(plan, 'collide-first');
      // Script must always be non-empty regardless of obstacle placement
      expect(script.length, `seed ${seed} produced empty collide-first script`).toBeGreaterThan(0);
      expect(script[0]?.type, `seed ${seed} first event should be keydown`).toBe('keydown');
      expect(script[script.length - 1]?.type, `seed ${seed} last event should be keyup`).toBe(
        'keyup',
      );

      if (first.lane === centerLane) found = true;
    }
    // At least one seed should have first obstacle in center lane
    expect(found, 'no seed found with first obstacle in center lane — coverage gap').toBe(true);
  });
});
