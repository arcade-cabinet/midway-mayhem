/**
 * Seed the track with obstacles + pickups deterministically from the same
 * seed that drove the track generator. Skips the first ~40m so the player
 * isn't smacked in the face at the starting line.
 *
 * Density is low — this is an arcade driver, not a bullet-hell.
 */
import type { World } from 'koota';
import { trackArchetypes } from '@/config';
import { Obstacle, Pickup } from '@/ecs/traits';
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
  // Content placement shares the deterministic track channel (obstacle + pickup
  // lane picks must match across replays). The xor-0xbee5 salt keeps content
  // from aliasing track-segment draws when both go through the same channel.
  const rng = createRng(seed ^ 0xbee5);
  const { obstacleCount = 30, pickupCount = 40, leadIn = 40 } = opts;
  const halfWidth = (trackArchetypes.laneWidth * trackArchetypes.lanes) / 2;
  const laneWidth = trackArchetypes.laneWidth;
  const totalLen = trackArchetypes.runLength * 20; // conservative upper bound
  const minDistance = leadIn;
  const maxDistance = totalLen - 40;

  for (let i = 0; i < obstacleCount; i++) {
    const kind: 'cone' | 'oil' = rng.next() > 0.4 ? 'cone' : 'oil';
    const distance = minDistance + rng.next() * (maxDistance - minDistance);
    // Snap lateral to a lane center.
    const lane = rng.int(0, trackArchetypes.lanes);
    const lateral = -halfWidth + laneWidth * (lane + 0.5);
    world.spawn(Obstacle({ kind, distance, lateral, consumed: false }));
  }

  for (let i = 0; i < pickupCount; i++) {
    const kind: 'balloon' | 'boost' = rng.next() > 0.18 ? 'balloon' : 'boost';
    const distance = minDistance + rng.next() * (maxDistance - minDistance);
    const lane = rng.int(0, trackArchetypes.lanes);
    const lateral = -halfWidth + laneWidth * (lane + 0.5);
    world.spawn(Pickup({ kind, distance, lateral, consumed: false }));
  }
}
