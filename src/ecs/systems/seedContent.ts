/**
 * Seed the track with obstacles + pickups deterministically from the same
 * seed that drove the track generator. Skips the first ~40m so the player
 * isn't smacked in the face at the starting line.
 *
 * Density is low — this is an arcade driver, not a bullet-hell.
 */
import type { World } from 'koota';
import { trackArchetypes, tunables } from '@/config';
import { Obstacle, type ObstacleKind, Pickup, type PickupKind } from '@/ecs/traits';
import { createRng } from '@/utils/rng';

interface Options {
  /** How many obstacles to spawn across the track. */
  obstacleCount?: number;
  /** How many pickups to spawn across the track. */
  pickupCount?: number;
  /** Minimum distance from start before anything spawns. */
  leadIn?: number;
}

export function seedContent(world: World, seed: number, opts: Options = {}): void {
  // Content placement uses a deterministic RNG stream derived from the same
  // base seed as track generation. The xor-salt forks content onto its own
  // reproducible stream so obstacle + pickup lane picks stay stable across
  // replays without consuming the exact same channel as track-segment draws.
  const rng = createRng(seed ^ tunables.rngSalt);
  const { obstacleCount = 30, pickupCount = 40, leadIn = 40 } = opts;
  const halfWidth = (trackArchetypes.laneWidth * trackArchetypes.lanes) / 2;
  const laneWidth = trackArchetypes.laneWidth;
  const totalLen = trackArchetypes.runLength * 20; // conservative upper bound
  const minDistance = leadIn;
  const maxDistance = totalLen - 40;

  // Obstacle kind weights — cones + oil dominate, others add variety.
  const obstacleKinds: readonly ObstacleKind[] = [
    'cone',
    'cone',
    'cone',
    'oil',
    'oil',
    'barrier',
    'gate',
    'hammer',
  ];
  for (let i = 0; i < obstacleCount; i++) {
    const kind = obstacleKinds[rng.int(0, obstacleKinds.length)] ?? 'cone';
    const distance = minDistance + rng.next() * (maxDistance - minDistance);
    // Snap lateral to a lane center.
    const lane = rng.int(0, trackArchetypes.lanes);
    const lateral = -halfWidth + laneWidth * (lane + 0.5);
    world.spawn(Obstacle({ kind, distance, lateral, consumed: false }));
  }

  // Pickup kind weights — balloons dominate, boost occasional, mega rare.
  const pickupKinds: readonly PickupKind[] = [
    'balloon',
    'balloon',
    'balloon',
    'balloon',
    'balloon',
    'boost',
    'boost',
    'mega',
  ];
  for (let i = 0; i < pickupCount; i++) {
    const kind = pickupKinds[rng.int(0, pickupKinds.length)] ?? 'balloon';
    const distance = minDistance + rng.next() * (maxDistance - minDistance);
    const lane = rng.int(0, trackArchetypes.lanes);
    const lateral = -halfWidth + laneWidth * (lane + 0.5);
    world.spawn(Pickup({ kind, distance, lateral, consumed: false }));
  }
}
