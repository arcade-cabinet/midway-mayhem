/**
 * @module game/runRngBus
 *
 * Process-global dual-channel PRNG for the active run. Rebuilt every time
 * gameState.startRun() fires so both channels are deterministic from the
 * run's master seed (which came from the seed phrase in NewRunModal).
 *
 *   - track  — run *construction* RNG. One-shot, used when placing the track
 *              permutation, spawn layouts, pickup positions, obstacle seeds.
 *              Same master seed ⇒ identical track every time.
 *
 *   - events — in-run streaming RNG for anything that fires during play:
 *              AI raids, barker callouts, balloon colors, visual jitter,
 *              animation timing, animal tumble variance. Burning entropy on
 *              this channel NEVER affects track construction.
 *
 * Callers MUST go through runRngBus — no more bare Math.random() in gameplay
 * code. Math.random() is fine for cosmetic UI (confetti on game-over etc),
 * but any state that affects gameplay routes through this.
 */

import { createRunRng, type RunRng } from '@/utils/rng';

let _rng: RunRng | null = null;
let _masterSeed = 0;

/** Rebuild both channels from `masterSeed`. Called by gameState.startRun. */
export function initRunRng(masterSeed: number): void {
  _masterSeed = masterSeed >>> 0;
  _rng = createRunRng(_masterSeed);
}

/**
 * Return the active RunRng. If no run has been started yet (unit tests in
 * isolation, diagnostics tooling) we lazily create one from a random seed —
 * gameplay code paths always call initRunRng() first so this fallback is
 * only ever hit by sandboxed tests.
 */
export function getRunRng(): RunRng {
  if (!_rng) {
    initRunRng(Math.floor(Math.random() * 2 ** 31));
  }
  return _rng as RunRng;
}

/** Convenience: track channel. Use for run-construction placements. */
export function trackRng() {
  return getRunRng().track;
}

/** Convenience: events channel. Use for in-run streaming randomness. */
export function eventsRng() {
  return getRunRng().events;
}

/** Master seed this run was built from (diagnostic). */
export function getMasterSeed(): number {
  return _masterSeed;
}

/** Test hook: nuke the singleton so unit tests start clean. */
export function _resetRunRng(): void {
  _rng = null;
  _masterSeed = 0;
}
