/**
 * MirrorDuplicator — Feature A (Funhouse Frenzy zone gimmick).
 *
 * For each real obstacle in the Funhouse Frenzy zone, up to 2 mirror copies
 * are placed at offset lanes. Mirrors flicker randomly; the real obstacle is
 * always steady. Collision only applies to the real obstacle.
 */

import type { Rng } from '@/utils/rng';
import { TRACK } from '@/utils/constants';

export interface MirrorEntry {
  realObstacleId: number;
  realLane: number;
  realD: number;
  copies: MirrorCopy[];
}

export interface MirrorCopy {
  lane: number;
  /** flickerPeriod in seconds — random each copy */
  flickerPeriod: number;
  /** phase offset so copies don't all flicker in sync */
  flickerPhase: number;
}

export class MirrorDuplicator {
  private entries = new Map<number, MirrorEntry>();

  constructor(private rng: Rng) {}

  /** Call with the current live obstacle list to sync mirror entries. */
  sync(obstacles: readonly { id: number; lane: number; d: number }[], zone: string) {
    if (zone !== 'funhouse-frenzy') {
      this.entries.clear();
      return;
    }

    const liveIds = new Set(obstacles.map((o) => o.id));

    // Remove stale
    for (const id of this.entries.keys()) {
      if (!liveIds.has(id)) this.entries.delete(id);
    }

    // Add new
    for (const o of obstacles) {
      if (this.entries.has(o.id)) continue;
      const copies: MirrorCopy[] = [];
      const usedLanes = new Set([o.lane]);
      const copyCount = this.rng.int(1, 3); // 1 or 2 copies
      for (let i = 0; i < copyCount; i++) {
        // Pick a lane not already used
        let attempts = 0;
        let lane: number;
        do {
          lane = this.rng.int(0, TRACK.LANE_COUNT);
          attempts++;
        } while (usedLanes.has(lane) && attempts < 10);
        if (usedLanes.has(lane)) continue;
        usedLanes.add(lane);
        copies.push({
          lane,
          flickerPeriod: 0.1 + this.rng.range(0, 0.3), // 0.1–0.4s
          flickerPhase: this.rng.range(0, Math.PI * 2),
        });
      }
      this.entries.set(o.id, {
        realObstacleId: o.id,
        realLane: o.lane,
        realD: o.d,
        copies,
      });
    }
  }

  getEntries(): readonly MirrorEntry[] {
    return [...this.entries.values()];
  }

  /**
   * Returns opacity for a mirror copy given elapsed time.
   * Flickers between 0 and 1 on a square wave at flickerPeriod.
   */
  copyOpacity(copy: MirrorCopy, nowSeconds: number): number {
    const phase = (nowSeconds / copy.flickerPeriod + copy.flickerPhase) % 1;
    return phase < 0.5 ? 0.85 : 0.0;
  }

  reset() {
    this.entries.clear();
  }

  get instanceCount(): number {
    let n = 0;
    for (const e of this.entries.values()) n += e.copies.length;
    return n;
  }
}
