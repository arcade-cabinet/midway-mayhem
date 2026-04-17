/**
 * BalloonSpawner — Feature A (Balloon Alley zone gimmick).
 *
 * Spawns floating balloon pickups that drift laterally across lanes over ~4s.
 * Only active while currentZone === 'balloon-alley'.
 */

import type { Rng } from '../utils/rng';
import { TRACK } from '../utils/constants';

export interface Balloon {
  id: number;
  d: number;        // distance along track (fixed at spawn)
  startLateral: number; // starting X offset
  targetLateral: number; // drift-to X offset
  driftDuration: number; // seconds for full drift
  spawnedAt: number; // performance.now() at spawn
  color: string;
  consumed: boolean;
}

/** Brand-palette balloon colors */
const BALLOON_COLORS = [
  '#e53935', // red
  '#ffd600', // yellow
  '#1e88e5', // blue
  '#8e24aa', // purple
  '#f36f21', // orange
] as const;

export class BalloonSpawner {
  private balloons: Balloon[] = [];
  private nextBalloonD = 0;
  private nextId = 1;

  constructor(private rng: Rng) {}

  /** Called each frame. Zone must be 'balloon-alley' or no spawn. */
  update(playerD: number, zone: string, nowMs: number) {
    if (zone !== 'balloon-alley') {
      // Recycle all balloons when outside the zone
      this.balloons = this.balloons.filter((b) => !b.consumed && b.d > playerD - 40);
      return;
    }

    // Spawn ahead
    if (this.nextBalloonD === 0) this.nextBalloonD = playerD + 20;
    while (this.nextBalloonD < playerD + 300) {
      this.spawnBalloon(this.nextBalloonD, nowMs);
      this.nextBalloonD += 15 + this.rng.range(0, 20);
    }

    // Recycle behind player and consumed
    this.balloons = this.balloons.filter((b) => b.d > playerD - 40 && !b.consumed);
  }

  private spawnBalloon(d: number, nowMs: number) {
    const startLateral = this.rng.range(-TRACK.HALF_WIDTH + 1, TRACK.HALF_WIDTH - 1);
    // Drift to the opposite side of center
    const driftDir = startLateral > 0 ? -1 : 1;
    const driftAmount = this.rng.range(3, TRACK.HALF_WIDTH);
    const targetLateral = Math.max(
      -TRACK.HALF_WIDTH + 1,
      Math.min(TRACK.HALF_WIDTH - 1, startLateral + driftDir * driftAmount),
    );
    this.balloons.push({
      id: this.nextId++,
      d,
      startLateral,
      targetLateral,
      driftDuration: 3.5 + this.rng.range(0, 1),
      spawnedAt: nowMs,
      color: BALLOON_COLORS[this.rng.int(0, BALLOON_COLORS.length)] ?? '#ffd600',
      consumed: false,
    });
  }

  /** Returns current lateral X for balloon at nowMs */
  balloonLateral(b: Balloon, nowMs: number): number {
    const elapsed = (nowMs - b.spawnedAt) / 1000;
    const t = Math.min(1, elapsed / b.driftDuration);
    // Ease in-out
    const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    return b.startLateral + (b.targetLateral - b.startLateral) * ease;
  }

  /** Check player collision — returns balloon id if touched, else null */
  checkCollision(playerD: number, playerLateral: number, nowMs: number): number | null {
    for (const b of this.balloons) {
      if (b.consumed) continue;
      if (Math.abs(b.d - playerD) > 4) continue;
      const lat = this.balloonLateral(b, nowMs);
      if (Math.abs(lat - playerLateral) < 2.5) {
        return b.id;
      }
    }
    return null;
  }

  consumeBalloon(id: number) {
    const b = this.balloons.find((x) => x.id === id);
    if (b) b.consumed = true;
  }

  getBalloons(): readonly Balloon[] {
    return this.balloons;
  }

  reset() {
    this.balloons = [];
    this.nextBalloonD = 0;
  }

  /** Diagnostics: active balloon count */
  get instanceCount(): number {
    return this.balloons.filter((b) => !b.consumed).length;
  }
}
