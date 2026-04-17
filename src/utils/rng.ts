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
