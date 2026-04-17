/**
 * Deterministic PRNG — splitmix64-style, seeded with an unsigned 32-bit int.
 * Every non-input randomness in the game routes through an RNG instance
 * constructed from a run seed, so the same seed always produces the same
 * track, same obstacles, same ghost replay.
 */

export class Rng {
  private state: bigint;

  constructor(seed: number) {
    // Splitmix64 is 64-bit; seed is a 32-bit int scaled into the space.
    this.state = BigInt(seed >>> 0) * 0x9e3779b97f4a7c15n + 1n;
  }

  /** Advance + return the next 32-bit unsigned integer. */
  nextU32(): number {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    z = z ^ (z >> 31n);
    return Number(z & 0xffffffffn);
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.nextU32() / 0x100000000;
  }

  /**
   * Uniform integer in [min, max]. Uses rejection sampling to avoid the
   * modulo bias that kicks in when (max-min+1) does not evenly divide 2^32
   * — critical for deterministic obstacle/pickup lane selection where the
   * range (e.g. 0..3) is not a power of two.
   */
  nextInt(min: number, max: number): number {
    const range = max - min + 1;
    const limit = Math.floor(0x100000000 / range) * range;
    let val = this.nextU32();
    while (val >= limit) {
      val = this.nextU32();
    }
    return min + (val % range);
  }

  /** Pick an entry from `items` weighted by each `weights[i]`. */
  weightedPick<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length === 0) throw new Error('Rng.weightedPick: empty array');
    if (items.length !== weights.length) {
      throw new Error('Rng.weightedPick: items/weights length mismatch');
    }
    let total = 0;
    for (const w of weights) total += w;
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i] as number;
      if (roll <= 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  }
}
