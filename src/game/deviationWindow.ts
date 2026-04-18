/**
 * @module game/deviationWindow
 *
 * Sliding-window racing-line deviation tracker.
 *
 * Kept at module scope (not inside ECS state) so the array is not
 * serialised. The window drives `cleanliness` in gameState via
 * `updateDeviationWindow` and is reset at the start of each run via
 * `resetDeviationWindow`.
 */

import { type OptimalPath, optimalLateralAt } from './optimalPath';

/** How far back (in metres) the window extends. */
export const DEVIATION_WINDOW_M = 200;
/** 0 m avg deviation → cleanliness 1.0; ≥ 3 m avg deviation → cleanliness 0.0 */
export const DEVIATION_MAX_M = 3;
/** EMA smoothing factor applied each tick so the readout isn't jittery. */
export const CLEANLINESS_EMA = 0.05;

interface DeviationSample {
  d: number;
  lateralM: number;
}

let _window: DeviationSample[] = [];

export function resetDeviationWindow(): void {
  _window = [];
}

/**
 * Add a sample and evict samples older than DEVIATION_WINDOW_M.
 * Returns the current raw mean-squared deviation over the window.
 */
export function updateDeviationWindow(d: number, lateral: number, optPath: OptimalPath): number {
  _window.push({ d, lateralM: lateral });

  // Evict samples that have fallen outside the sliding window
  const cutoff = d - DEVIATION_WINDOW_M;
  let i = 0;
  while (i < _window.length && (_window[i]?.d ?? 0) < cutoff) {
    i++;
  }
  if (i > 0) _window = _window.slice(i);

  if (_window.length < 2) return 0;

  let sq = 0;
  let span = 0;
  for (let j = 1; j < _window.length; j++) {
    const prev = _window[j - 1];
    const cur = _window[j];
    if (!prev || !cur) continue;
    const dM = cur.d - prev.d;
    if (dM <= 0) continue;
    const target = optimalLateralAt(optPath, cur.d);
    const err = cur.lateralM - target;
    sq += err * err * dM;
    span += dM;
  }
  return span > 0 ? sq / span : 0;
}
