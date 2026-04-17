// Deterministic splitmix64-derived PRNG for reproducible runs (daily seed, replay).

export function createRng(seed = Date.now()) {
  let state = BigInt(seed) | 1n;
  const MASK64 = (1n << 64n) - 1n;

  return {
    next(): number {
      state = (state + 0x9e3779b97f4a7c15n) & MASK64;
      let z = state;
      z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
      z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
      z = z ^ (z >> 31n);
      return Number(z & ((1n << 53n) - 1n)) / 2 ** 53;
    },
    range(min: number, max: number): number {
      return min + this.next() * (max - min);
    },
    int(min: number, max: number): number {
      return Math.floor(this.range(min, max));
    },
    pick<T>(arr: readonly T[]): T {
      if (arr.length === 0) throw new Error('pick from empty array');
      return arr[Math.floor(this.next() * arr.length)] as T;
    },
    reseed(newSeed: number) {
      state = BigInt(newSeed) | 1n;
    },
  };
}

export type Rng = ReturnType<typeof createRng>;

export function dailySeed(date: Date = new Date()): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return y * 10000 + m * 100 + d;
}

// ─── Dual-channel PRNG ──────────────────────────────────────────────────────

/**
 * A single run's PRNG bundle: one deterministic channel for track generation
 * and a SEPARATE channel for mid-game random events (AI raids, balloon spawns,
 * barker callouts). Separating the two means mid-game randomness doesn't
 * perturb track geometry — the track is identical for the same seed no matter
 * how many random events fire during play.
 *
 * Both channels are splitmix64-derived from the same seed via distinct domain
 * salts. This is the standard pattern for hierarchical seeding: hash
 * (seed ⊕ salt) → new generator state.
 */
export interface RunRng {
  /** Use for track composition, permutation, zone layout, obstacle placement. */
  track: Rng;
  /** Use for AI raids, balloon spawns, barker callouts, visual variance. */
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
