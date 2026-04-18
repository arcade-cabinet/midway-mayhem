/**
 * ObstacleSpawner — streams obstacles + pickups ahead of the player.
 *
 * Uses the rng.events channel so spawning entropy never perturbs track
 * construction. Zone weights are static defaults here until the config
 * system (tunables) is ported (Task #124).
 *
 * TODO(Task #124): replace static defaults with tunables() once
 * @/config/index is ported.
 * TODO(Task #124): replace laneCenterAt with the real trackComposer
 * once @/track/trackComposer is ported. Current stub returns a flat-track
 * lane centre so tests pass without the composer.
 */

import type { CritterKind, ObstacleType, PickupType, ZoneId } from '@/utils/constants';
import { CRITTER_KINDS, HONK, TRACK } from '@/utils/constants';
import type { Rng } from '@/utils/rng';

export interface Obstacle {
  id: number;
  type: ObstacleType;
  d: number; // distance along track
  lane: number; // 0..LANE_COUNT-1
  x: number;
  y: number;
  z: number;
  swingPhase: number; // hammer
  radius: number;
  /** critter-only: which animal model */
  critter?: CritterKind;
  /** critter-only: performance.now() when honked (0 = not fleeing) */
  fleeStartedAt?: number;
  /** critter-only: which lateral direction to flee (-1 or +1) */
  fleeDir?: -1 | 1;
}

export interface Pickup {
  id: number;
  type: PickupType;
  d: number;
  lane: number;
  x: number;
  y: number;
  z: number;
  consumed: boolean;
  radius: number;
}

// ─── Spawn parameters (TODO: replace with tunables()) ───────────────────────

const SPAWN = {
  minGap: 18,
  jitter: 22,
  pickupMinGap: 35,
  pickupJitter: 30,
} as const;

const CRITTER_THRESHOLDS = {
  pickupMegaThreshold: 0.93,
  pickupBoostThreshold: 0.7,
} as const;

/** Zone-based obstacle type weights (static defaults). */
const ZONE_WEIGHTS: Record<ZoneId, Record<ObstacleType, number>> = {
  'midway-strip': { barrier: 1, cones: 2, gate: 1, oil: 1, hammer: 0, critter: 2 },
  'balloon-alley': { barrier: 1, cones: 2, gate: 2, oil: 2, hammer: 1, critter: 2 },
  'ring-of-fire': { barrier: 2, cones: 1, gate: 1, oil: 3, hammer: 2, critter: 1 },
  'funhouse-frenzy': { barrier: 2, cones: 2, gate: 2, oil: 2, hammer: 3, critter: 3 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Flat-track lane centre. Used until trackComposer is ported.
 * TODO(Task #124): replace with real trackComposer.laneCenterAt.
 */
function laneCenterAt(_d: number, lane: number): { x: number; y: number; z: number } {
  const half = (TRACK.LANE_COUNT - 1) / 2;
  return { x: (lane - half) * TRACK.LANE_WIDTH, y: 0, z: -_d };
}

function weightedPick(weights: Record<ObstacleType, number>, rng: Rng): ObstacleType {
  const entries = Object.entries(weights) as [ObstacleType, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng.next() * total;
  for (const [t, w] of entries) {
    r -= w;
    if (r <= 0) return t;
  }
  return 'cones';
}

// ─── ObstacleSpawner ─────────────────────────────────────────────────────────

export class ObstacleSpawner {
  private obstacles: Obstacle[] = [];
  private pickups: Pickup[] = [];
  private nextObstacleD = 80;
  private nextPickupD = 60;
  private nextId = 1;

  constructor(private rng: Rng) {}

  update(playerD: number, zone: ZoneId, lookAheadD = 500) {
    while (this.nextObstacleD < playerD + lookAheadD) {
      this.spawnObstacle(this.nextObstacleD, zone);
      this.nextObstacleD += SPAWN.minGap + this.rng.range(0, SPAWN.jitter);
    }
    while (this.nextPickupD < playerD + lookAheadD) {
      this.spawnPickup(this.nextPickupD);
      this.nextPickupD += SPAWN.pickupMinGap + this.rng.range(0, SPAWN.pickupJitter);
    }

    // recycle past-camera
    const cutoff = playerD - 40;
    this.obstacles = this.obstacles.filter((o) => o.d > cutoff);
    this.pickups = this.pickups.filter((p) => p.d > cutoff && !p.consumed);
  }

  private spawnObstacle(d: number, zone: ZoneId) {
    const type = weightedPick(ZONE_WEIGHTS[zone], this.rng);
    const lane = this.rng.int(0, TRACK.LANE_COUNT);
    const pos = laneCenterAt(d, lane);
    const critter: CritterKind | undefined =
      type === 'critter'
        ? (CRITTER_KINDS[this.rng.int(0, CRITTER_KINDS.length)] ?? 'cow')
        : undefined;
    this.obstacles.push({
      id: this.nextId++,
      type,
      d,
      lane,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      swingPhase: this.rng.range(0, Math.PI * 2),
      radius: type === 'gate' ? 3 : type === 'oil' ? 2.2 : type === 'critter' ? 1.8 : 1.6,
      ...(critter ? { critter } : {}),
    });
  }

  /**
   * Scare any critter within SCARE_RADIUS_M ahead of the player into fleeing.
   * Returns the number of critters that started fleeing.
   */
  scareCritters(playerD: number, now: number): number {
    let scared = 0;
    for (const o of this.obstacles) {
      if (o.type !== 'critter') continue;
      if (o.fleeStartedAt) continue; // already fleeing
      const ahead = o.d - playerD;
      if (ahead < 0 || ahead > HONK.SCARE_RADIUS_M) continue;
      o.fleeStartedAt = now;
      o.fleeDir = this.rng.next() < 0.5 ? -1 : 1;
      scared++;
    }
    return scared;
  }

  private spawnPickup(d: number) {
    const roll = this.rng.next();
    const type: PickupType =
      roll > CRITTER_THRESHOLDS.pickupMegaThreshold
        ? 'mega'
        : roll > CRITTER_THRESHOLDS.pickupBoostThreshold
          ? 'boost'
          : 'ticket';
    const lane = this.rng.int(0, TRACK.LANE_COUNT);
    const pos = laneCenterAt(d, lane);
    this.pickups.push({
      id: this.nextId++,
      type,
      d,
      lane,
      x: pos.x,
      y: pos.y + 1.6,
      z: pos.z,
      consumed: false,
      radius: type === 'mega' ? 2.2 : 1.4,
    });
  }

  getObstacles(): readonly Obstacle[] {
    return this.obstacles;
  }
  getPickups(): readonly Pickup[] {
    return this.pickups;
  }
  consumePickup(id: number) {
    const p = this.pickups.find((x) => x.id === id);
    if (p) p.consumed = true;
  }
  reset(playerD = 0) {
    this.obstacles = [];
    this.pickups = [];
    this.nextObstacleD = playerD + 80;
    this.nextPickupD = playerD + 60;
  }

  /**
   * Deterministically place one obstacle of `type` at exact distance `d` and
   * lane `lane`. Used by lane-alignment tests only — not called in production.
   */
  spawnAtExact(d: number, lane: number, type: ObstacleType) {
    const pos = laneCenterAt(d, lane);
    const critter: CritterKind | undefined = type === 'critter' ? 'cow' : undefined;
    this.obstacles.push({
      id: this.nextId++,
      type,
      d,
      lane,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      swingPhase: 0,
      radius: type === 'gate' ? 3 : type === 'oil' ? 2.2 : type === 'critter' ? 1.8 : 1.6,
      ...(critter ? { critter } : {}),
    });
  }
}
