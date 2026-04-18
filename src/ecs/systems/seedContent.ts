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
import { CRITTER_KINDS, type ZoneId, zoneForDistance } from '@/utils/constants';
import { createRng } from '@/utils/rng';

/**
 * Zone-specific obstacle weights. Higher numbers = more common. These
 * mirror the weights that obstacleSpawner.ts (orphan) uses per zone;
 * kept here in parallel so the live seedContent path delivers the same
 * zone identity without waiting on the full obstacleSpawner wire-up.
 *
 * - Midway Strip: cones + oil, moderate barriers — the tutorial lane; critters roam freely
 * - Balloon Alley: more gates (lane cues), fewer hazards — pop balloons; some critters
 * - Ring of Fire: more oil + hammers, fewer cones — heat is on; critters flee the fire
 * - Funhouse Frenzy: mixed chaos, every kind roughly equal; most critter appearances
 */
const OBSTACLE_ZONE_WEIGHTS: Record<ZoneId, Record<ObstacleKind, number>> = {
  'midway-strip': { cone: 4, oil: 2, barrier: 1, gate: 1, hammer: 0, critter: 2 },
  'balloon-alley': { cone: 2, oil: 1, barrier: 1, gate: 3, hammer: 1, critter: 2 },
  'ring-of-fire': { cone: 1, oil: 3, barrier: 2, gate: 1, hammer: 3, critter: 1 },
  'funhouse-frenzy': { cone: 2, oil: 2, barrier: 2, gate: 2, hammer: 2, critter: 3 },
};

const PICKUP_ZONE_WEIGHTS: Record<ZoneId, Record<PickupKind, number>> = {
  'midway-strip': { balloon: 5, boost: 1, mega: 0 },
  'balloon-alley': { balloon: 8, boost: 1, mega: 1 },
  'ring-of-fire': { balloon: 3, boost: 3, mega: 1 },
  'funhouse-frenzy': { balloon: 4, boost: 2, mega: 2 },
};

function pickWeighted<K extends string>(
  rng: { next: () => number },
  weights: Record<K, number>,
): K {
  let total = 0;
  for (const k in weights) total += weights[k as K];
  let pick = rng.next() * total;
  for (const k in weights) {
    pick -= weights[k as K];
    if (pick < 0) return k as K;
  }
  // Fallback to first key if total was 0 or rounding slipped.
  return Object.keys(weights)[0] as K;
}

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

  // Obstacle spawns: kind picked from the active-zone weight table at
  // the spawn distance. Zone identity drives the flavor of each ~450m
  // segment (see ZONES / zoneForDistance).
  for (let i = 0; i < obstacleCount; i++) {
    const distance = minDistance + rng.next() * (maxDistance - minDistance);
    const zone = zoneForDistance(distance);
    const kind = pickWeighted(rng, OBSTACLE_ZONE_WEIGHTS[zone]);
    // Snap lateral to a lane center.
    const lane = rng.int(0, trackArchetypes.lanes);
    const lateral = -halfWidth + laneWidth * (lane + 0.5);
    // Critter-kind is picked deterministically from the CRITTER_KINDS array.
    const critterKind =
      kind === 'critter'
        ? (CRITTER_KINDS[rng.int(0, CRITTER_KINDS.length)] ?? 'cow')
        : ('' as const);
    // Hammer swing phase: baked at spawn so each hammer is visually offset.
    const swingPhase = kind === 'hammer' ? rng.next() * Math.PI * 2 : 0;
    world.spawn(
      Obstacle({ kind, distance, lateral, consumed: false, critterKind, swingPhase }),
    );
  }

  // Pickup spawns: same zone-weighted pattern. Balloon Alley skews
  // hard toward balloons; Ring of Fire trades some balloons for boosts.
  for (let i = 0; i < pickupCount; i++) {
    const distance = minDistance + rng.next() * (maxDistance - minDistance);
    const zone = zoneForDistance(distance);
    const kind = pickWeighted(rng, PICKUP_ZONE_WEIGHTS[zone]);
    const lane = rng.int(0, trackArchetypes.lanes);
    const lateral = -halfWidth + laneWidth * (lane + 0.5);
    world.spawn(Pickup({ kind, distance, lateral, consumed: false }));
  }
}
