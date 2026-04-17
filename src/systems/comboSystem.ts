/**
 * CROWD CHAIN combo meter.
 *
 * Events: 'scare' | 'pickup' | 'near-miss'
 * Chain expires if > 3.5 s since last event.
 * Multiplier curve: chain 0 → 1×, 3 → 2×, 7 → 4×, 15 → 8×.
 * Reset on hit via registerHit().
 */

export type ComboEventKind = 'scare' | 'pickup' | 'near-miss';

/** Chain-length thresholds for each multiplier tier. */
const CHAIN_THRESHOLDS: [number, number][] = [
  [15, 8],
  [7, 4],
  [3, 2],
  [0, 1],
];

const CHAIN_EXPIRY_MS = 3500;

/** Sentinel meaning "no event recorded yet" — lets t=0 be a valid event time. */
const NO_EVENT = -1;

export class ComboSystem {
  private chain = 0;
  private lastEventAt = NO_EVENT;
  /** Injectable clock — defaults to performance.now for production. */
  readonly clock: () => number;

  constructor(clock: () => number = () => performance.now()) {
    this.clock = clock;
  }

  registerEvent(kind: ComboEventKind): void {
    void kind; // kind recorded for future analytics — intentional no-op for now
    const now = this.clock();
    if (
      this.chain > 0 &&
      this.lastEventAt !== NO_EVENT &&
      now - this.lastEventAt > CHAIN_EXPIRY_MS
    ) {
      this.chain = 0;
    }
    this.chain += 1;
    this.lastEventAt = now;
  }

  registerHit(): void {
    this.chain = 0;
    this.lastEventAt = NO_EVENT;
  }

  getMultiplier(): number {
    const now = this.clock();
    const expired =
      this.chain > 0 &&
      this.lastEventAt !== NO_EVENT &&
      now - this.lastEventAt > CHAIN_EXPIRY_MS;
    const effectiveChain = expired ? 0 : this.chain;
    for (const [threshold, mult] of CHAIN_THRESHOLDS) {
      if (effectiveChain >= threshold) return mult;
    }
    return 1;
  }

  getChainLength(): number {
    const now = this.clock();
    if (
      this.chain > 0 &&
      this.lastEventAt !== NO_EVENT &&
      now - this.lastEventAt > CHAIN_EXPIRY_MS
    ) {
      return 0;
    }
    return this.chain;
  }

  getLastEventAt(): number {
    return this.lastEventAt === NO_EVENT ? 0 : this.lastEventAt;
  }

  /** Reset for new run. */
  reset(): void {
    this.chain = 0;
    this.lastEventAt = NO_EVENT;
  }
}

/** Module-level singleton — used across ObstacleSystem, HUD, and gameState. */
export const combo = new ComboSystem();
