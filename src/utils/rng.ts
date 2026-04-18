/**
 * Deterministic splitmix64-derived PRNG for reproducible runs (daily seed,
 * replay, seed phrases).
 *
 * Two APIs:
 *  - `createRng(seed)` — a single-channel generator with next/range/int/pick/
 *    weightedPick/reseed.
 *  - `createRunRng(masterSeed)` — a dual-channel bundle:
 *      * `track`  — track composition, permutation, zone layout, obstacle
 *                   placement (anything that must be identical across runs
 *                   with the same seed).
 *      * `events` — mid-game randomness: AI raids, balloon spawns, barker
 *                   callouts, visual variance. Burning entropy here does NOT
 *                   perturb track geometry.
 *
 * Both channels are splitmix64 seeded via a 32-bit domain-salt mix of the
 * master seed, so the same master seed always produces identical channels
 * but the channels are independent of each other.
 */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Uniform integer in [min, max). Rejection-sampled to avoid modulo bias. */
  int(min: number, max: number): number;
  /** Pick a uniformly random element from a non-empty readonly array. */
  pick<T>(arr: readonly T[]): T;
  /** Pick an element weighted by the parallel weights array. */
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T;
  /** Reseed in-place. Same seed → same sequence as a fresh createRng. */
  reseed(newSeed: number): void;
}

const MASK64 = (1n << 64n) - 1n;
const MULT = 0x9e3779b97f4a7c15n;
const MIX1 = 0xbf58476d1ce4e5b9n;
const MIX2 = 0x94d049bb133111ebn;

export function createRng(seed: number = Date.now()): Rng {
  // Mix seed with MULT so seeds 0 and 1 produce distinct states and
  // non-integral floats are safely truncated (BigInt() throws on non-integers).
  let state = (BigInt(Math.floor(seed)) + MULT) & MASK64;

  function nextU53(): number {
    state = (state + MULT) & MASK64;
    let z = state;
    z = ((z ^ (z >> 30n)) * MIX1) & MASK64;
    z = ((z ^ (z >> 27n)) * MIX2) & MASK64;
    z = z ^ (z >> 31n);
    return Number(z & ((1n << 53n) - 1n));
  }

  function nextU32(): number {
    // Use high 32 bits of the scrambled state for better statistical quality.
    state = (state + MULT) & MASK64;
    let z = state;
    z = ((z ^ (z >> 30n)) * MIX1) & MASK64;
    z = ((z ^ (z >> 27n)) * MIX2) & MASK64;
    z = z ^ (z >> 31n);
    return Number((z >> 32n) & 0xffffffffn);
  }

  function next(): number {
    return nextU53() / 2 ** 53;
  }

  return {
    next,
    range(min: number, max: number): number {
      return min + next() * (max - min);
    },
    int(min: number, max: number): number {
      // Rejection sampling: avoid the modulo bias that kicks in when
      // (max-min) does not evenly divide 2^32 — critical for lane selection
      // with non-power-of-two lane counts.
      const range = max - min;
      if (range <= 0) throw new Error('Rng.int: max must be > min');
      const limit = Math.floor(0x100000000 / range) * range;
      let val = nextU32();
      while (val >= limit) val = nextU32();
      return min + (val % range);
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error('Rng.pick: empty array');
      return arr[Math.floor(next() * arr.length)] as T;
    },
    weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
      if (items.length === 0) throw new Error('Rng.weightedPick: empty array');
      if (items.length !== weights.length) {
        throw new Error('Rng.weightedPick: items/weights length mismatch');
      }
      let total = 0;
      for (const w of weights) total += w;
      let roll = next() * total;
      for (let i = 0; i < items.length; i++) {
        roll -= weights[i] as number;
        if (roll <= 0) return items[i] as T;
      }
      return items[items.length - 1] as T;
    },
    reseed(newSeed: number): void {
      state = (BigInt(Math.floor(newSeed)) + MULT) & MASK64;
    },
  };
}

/** UTC-date → stable integer seed. Used for daily seed runs. */
export function dailySeed(date: Date = new Date()): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return y * 10000 + m * 100 + d;
}

// ─── Dual-channel PRNG ──────────────────────────────────────────────────────

export interface RunRng {
  /** Track composition, zone layout, obstacle placement. */
  track: Rng;
  /** AI raids, balloon spawns, barker callouts, visual variance. */
  events: Rng;
}

const TRACK_SALT = 0x7a1e_9ac6;
const EVENTS_SALT = 0xb9c0_2e51;

function mixSalt(seed: number, salt: number): number {
  // 32-bit splitmix-style mix so tiny seed deltas produce large channel deltas.
  let s = ((seed >>> 0) ^ salt) >>> 0;
  s = Math.imul(s ^ (s >>> 16), 0x85eb_ca6b) >>> 0;
  s = Math.imul(s ^ (s >>> 13), 0xc2b2_ae35) >>> 0;
  s = (s ^ (s >>> 16)) >>> 0;
  return s;
}

/**
 * Build the dual-channel RNG for a run from a single master seed.
 * Same seed → identical channels every time.
 */
export function createRunRng(masterSeed: number): RunRng {
  return {
    track: createRng(mixSalt(masterSeed, TRACK_SALT)),
    events: createRng(mixSalt(masterSeed, EVENTS_SALT)),
  };
}
