/**
 * @module game/dailyRoute
 *
 * Daily Route system — deterministic per-UTC-day seed, track permutation,
 * and the isDailyRoute flag.
 *
 * Seed derivation: stable 32-bit hash of the UTC date string "yyyy-mm-dd".
 * Same date → same seed in any timezone that shares the UTC day.
 *
 * Track composition: composeTrack() is extended via the seeded permutation
 * exported here. The interior pieces (all except first "start" and last "end")
 * are shuffled with splitmix64-derived Fisher-Yates using the daily seed.
 */

import type { PieceKind } from './trackComposer';

// ─── Seed derivation ────────────────────────────────────────────────────────

/**
 * Returns the UTC date string for a given timestamp (or now).
 * Format: "yyyy-mm-dd"
 */
export function utcDateString(ms?: number): string {
  const d = new Date(ms ?? Date.now());
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Stable 32-bit hash of an arbitrary string (djb2 variant).
 * Deterministic across JS engines and platforms.
 */
function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

/**
 * Returns the daily seed for the current UTC day (or a given ms timestamp).
 * Always the same value within one UTC day.
 */
export function getDailySeed(ms?: number): number {
  return hashString(utcDateString(ms));
}

// ─── isDailyRoute flag ──────────────────────────────────────────────────────

let _isDailyRoute = true;

/**
 * Returns true when the game is in Daily Route mode.
 * Defaults to true; `?practice=1` URL param disables it.
 * Call setDailyRoute(false) to switch to practice mode.
 */
export function isDailyRoute(): boolean {
  return _isDailyRoute;
}

export function setDailyRoute(on: boolean): void {
  _isDailyRoute = on;
}

/** Read URL params and configure daily/practice mode. Call once at boot. */
export function initDailyRouteFromUrl(): void {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('practice') === '1') _isDailyRoute = false;
  }
}

// ─── Seeded permutation ─────────────────────────────────────────────────────

/**
 * Splitmix64-derived pseudo-random number generator.
 * Returns a function that produces floats in [0, 1).
 */
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s ^ (s >>> 16)) >>> 0;
    s = Math.imul(s, 0x45d9f3b) >>> 0;
    s = (s ^ (s >>> 16)) >>> 0;
    s = Math.imul(s, 0x45d9f3b) >>> 0;
    s = (s ^ (s >>> 16)) >>> 0;
    return (s >>> 0) / 0x100000000;
  };
}

/**
 * Fisher-Yates shuffle of an array, in-place. Uses `rng` for determinism.
 */
function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

/**
 * Returns a seeded permutation of the given track piece list.
 *
 * The first piece ('start') and last piece ('end') are kept in place.
 * Interior pieces are shuffled deterministically using `seed`.
 *
 * Note: the per-run seed comes from gameState (set by NewRunModal via a seed
 * phrase). The daily seed is just a stable default for leaderboards.
 */
export function permuteTrack(base: readonly PieceKind[], seed: number): PieceKind[] {
  if (base.length <= 2) return [...base];
  const first = base[0] as PieceKind;
  const last = base[base.length - 1] as PieceKind;
  const interior = base.slice(1, -1).map((k) => k);
  const rng = seededRng(seed);
  shuffleArray(interior, rng);
  return [first, ...interior, last];
}

/**
 * Run-construction permutation — consumes the track RNG channel (one-shot).
 * Call exactly once at run start, NOT per-frame. Do NOT use events RNG here
 * or the track layout will diverge based on mid-run event entropy.
 */
export function permuteTrackWithRng(
  base: readonly PieceKind[],
  trackRng: { next(): number },
): PieceKind[] {
  if (base.length <= 2) return [...base];
  const first = base[0] as PieceKind;
  const last = base[base.length - 1] as PieceKind;
  const interior = base.slice(1, -1).map((k) => k);
  shuffleArray(interior, () => trackRng.next());
  return [first, ...interior, last];
}
