import type { Obstacle, Pickup } from './obstacleSpawner';

export interface PlayerPose {
  d: number;
  x: number;
  z: number;
  radius: number;
}

export interface CollisionReport {
  obstacleHits: Obstacle[];
  pickupHits: Pickup[];
}

/** Sphere-based collision on the XZ plane. */
export function detectCollisions(
  player: PlayerPose,
  obstacles: readonly Obstacle[],
  pickups: readonly Pickup[],
): CollisionReport {
  const obstacleHits: Obstacle[] = [];
  const pickupHits: Pickup[] = [];

  for (const o of obstacles) {
    if (Math.abs(o.d - player.d) > 8) continue;
    const dx = o.x - player.x;
    const dz = o.z - player.z;
    const r = o.radius + player.radius;
    if (dx * dx + dz * dz < r * r) obstacleHits.push(o);
  }
  for (const p of pickups) {
    if (p.consumed) continue;
    if (Math.abs(p.d - player.d) > 8) continue;
    const dx = p.x - player.x;
    const dz = p.z - player.z;
    const r = p.radius + player.radius;
    if (dx * dx + dz * dz < r * r) pickupHits.push(p);
  }
  return { obstacleHits, pickupHits };
}
