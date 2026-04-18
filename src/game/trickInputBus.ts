/**
 * TrickInputBus — a tiny queue that decouples input hooks (which run in
 * React event callbacks) from TrickSystem (which runs in the RAF loop).
 *
 * Input hooks call `trickInputBus.push(input)`.
 * The GameLoop calls `trickInputBus.drain()` once per frame and forwards
 * the results to `TrickSystem.pushInput()`.
 */
import type { TrickInput } from '@/game/trickSystem';

class TrickInputBus {
  private queue: TrickInput[] = [];

  push(input: TrickInput): void {
    this.queue.push(input);
  }

  /** Remove and return all queued inputs, preserving order. */
  drain(): TrickInput[] {
    if (this.queue.length === 0) return [];
    const out = this.queue;
    this.queue = [];
    return out;
  }

  clear(): void {
    this.queue = [];
  }
}

export const trickInputBus = new TrickInputBus();
