/**
 * @/config — public barrel for the tunables sub-package.
 *
 * `tunables` is a mutable proxy backed by DEFAULT_TUNABLES initially.
 * After loadTunables() resolves, call applyLoadedTunables(t) to deep-merge
 * the fetched values. All consumers reading `tunables` at call-time (not
 * module-eval time) will see the live values automatically.
 */

export { loadTunables } from './loader';
export type { Tunables, ZoneTunable, ZoneWeights } from './schema';
export { parseTunables } from './schema';
export { DEFAULT_TUNABLES } from './defaults';

import type { Tunables } from './schema';
import { DEFAULT_TUNABLES } from './defaults';

// Internal mutable store
let _current: Tunables = DEFAULT_TUNABLES;

/**
 * tunables — always returns the current live tunables.
 * Use as a function call: `tunables().speed.cruise`
 * This avoids holding stale references to the pre-load defaults.
 */
export function tunables(): Tunables {
  return _current;
}

/**
 * applyLoadedTunables — deep-merge `t` onto the current tunables.
 * Called once in App.tsx after loadTunables() resolves.
 */
export function applyLoadedTunables(t: Tunables): void {
  _current = Object.freeze({ ..._current, ...t }) as Tunables;
}

/** Reset to defaults (test helper). */
export function resetTunablesToDefaults(): void {
  _current = DEFAULT_TUNABLES;
}
