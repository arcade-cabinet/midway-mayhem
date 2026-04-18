/**
 * @module game/trickInputBus
 *
 * Thin decoupling layer between input hooks (useKeyboard, TouchControls)
 * and the TrickSystem instance that lives inside useGameSystems.
 *
 * Input hooks call `trickInputBus.push(direction)` immediately when they
 * detect a trick gesture. useGameSystems drains the queue on each RAF frame
 * and forwards the inputs to TrickSystem.pushInput().
 *
 * No React state, no ECS traits — just a plain array acting as a queue.
 */
import type { TrickInput } from './trickSystem';

class TrickInputBus {
  private queue: TrickInput[] = [];

  /** Called by input hooks when a trick gesture is detected. */
  push(input: TrickInput): void {
    this.queue.push(input);
  }

  /**
   * Drain all queued inputs and return them.
   * useGameSystems calls this once per frame and forwards to TrickSystem.
   */
  drain(): TrickInput[] {
    if (this.queue.length === 0) return [];
    const out = this.queue;
    this.queue = [];
    return out;
  }

  /** Clear without processing — called on run reset. */
  clear(): void {
    this.queue = [];
  }
}

export const trickInputBus = new TrickInputBus();
