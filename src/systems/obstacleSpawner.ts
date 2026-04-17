import type { ObstacleType, PickupType, ZoneId } from '../utils/constants';
import { TRACK } from '../utils/constants';
import type { Rng } from '../utils/rng';
import { laneCenterAt } from './trackGenerator';

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

const ZONE_WEIGHTS: Record<ZoneId, Record<ObstacleType, number>> = {
  'midway-strip': { barrier: 1, cones: 2, gate: 1, oil: 1, hammer: 0 },
  'balloon-alley': { barrier: 1, cones: 2, gate: 2, oil: 2, hammer: 1 },
  'ring-of-fire': { barrier: 2, cones: 1, gate: 1, oil: 3, hammer: 2 },
  'funhouse-frenzy': { barrier: 2, cones: 2, gate: 2, oil: 2, hammer: 3 },
};

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
      this.nextObstacleD += 18 + this.rng.range(0, 22);
    }
    while (this.nextPickupD < playerD + lookAheadD) {
      this.spawnPickup(this.nextPickupD);
      this.nextPickupD += 14 + this.rng.range(0, 20);
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
    this.obstacles.push({
      id: this.nextId++,
      type,
      d,
      lane,
      x: pos.x,
      y: pos.y,
      z: pos.z,
      swingPhase: this.rng.range(0, Math.PI * 2),
      radius: type === 'gate' ? 3 : type === 'oil' ? 2.2 : 1.6,
    });
  }

  private spawnPickup(d: number) {
    const roll = this.rng.next();
    const type: PickupType = roll > 0.97 ? 'mega' : roll > 0.55 ? 'boost' : 'ticket';
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
}
