/**
 * Brand palette + static enum types.
 *
 * Anything that needs tuning at runtime lives in src/config (tunables.json,
 * archetypes, schemas). This file only holds values that are identity —
 * brand colors, the canonical zone list, the closed set of obstacle kinds.
 */

export const COLORS = {
  RED: '#e53935',
  YELLOW: '#ffd600',
  BLUE: '#1e88e5',
  PURPLE: '#8e24aa',
  ORANGE: '#f36f21',
  GREEN: '#43a047',
  NIGHT: '#0b0f1a',
} as const;

export const ZONES = [
  { id: 'midway-strip', name: 'The Midway Strip', start: 0, length: 450 },
  { id: 'balloon-alley', name: 'Balloon Alley', start: 450, length: 450 },
  { id: 'ring-of-fire', name: 'Ring of Fire', start: 900, length: 450 },
  { id: 'funhouse-frenzy', name: 'Funhouse Frenzy', start: 1350, length: 450 },
] as const;

export type ZoneId = (typeof ZONES)[number]['id'];

/** Cycle length of the zone rotation, in meters. */
export const ZONE_CYCLE_M = ZONES.reduce((sum, z) => sum + z.length, 0);

/**
 * Return the ZoneId for any distance along the track, wrapping around
 * when d exceeds the first cycle. Pure function — same (d) → same zone.
 */
export function zoneForDistance(d: number): ZoneId {
  const wrapped = ((d % ZONE_CYCLE_M) + ZONE_CYCLE_M) % ZONE_CYCLE_M;
  for (const z of ZONES) {
    if (wrapped >= z.start && wrapped < z.start + z.length) return z.id;
  }
  // Should be unreachable given ZONE_CYCLE_M covers [0, cycle); guard anyway.
  return ZONES[0].id;
}

export const OBSTACLE_TYPES = ['barrier', 'cones', 'gate', 'oil', 'hammer', 'critter'] as const;
export type ObstacleType = (typeof OBSTACLE_TYPES)[number];

export const CRITTER_KINDS = ['cow', 'horse', 'llama', 'pig'] as const;
export type CritterKind = (typeof CRITTER_KINDS)[number];

export const PICKUP_TYPES = ['boost', 'ticket', 'mega'] as const;
export type PickupType = (typeof PICKUP_TYPES)[number];

// ─── Track / Honk / Steer — facades over tunables.json ──────────────────────
//
// These objects preserve the legacy uppercase-field API that ~25 call sites
// consume. The source of truth is src/config/tunables.json under the
// `track`, `honk`, and `steer` blocks — edit the JSON, not these bindings.

import { tunables } from '@/config';

export const TRACK = {
  LANE_COUNT: tunables.track.laneCount,
  LANE_WIDTH: tunables.track.laneWidthM,
  get WIDTH() {
    return tunables.track.laneCount * tunables.track.laneWidthM;
  },
  get HALF_WIDTH() {
    return (tunables.track.laneCount * tunables.track.laneWidthM) / 2;
  },
  get LATERAL_CLAMP() {
    return (
      (tunables.track.laneCount * tunables.track.laneWidthM) / 2 -
      tunables.track.lateralClampInsetM
    );
  },
} as const;

/** World-space X for the centre of a given lane index (0 = leftmost). */
export function laneCenterX(laneIndex: number): number {
  const half = (tunables.track.laneCount - 1) / 2;
  return (laneIndex - half) * tunables.track.laneWidthM;
}

export const HONK = {
  SCARE_RADIUS_M: tunables.honk.scareRadiusM,
  FLEE_LATERAL_M: tunables.honk.fleeLateralM,
  FLEE_DURATION_S: tunables.honk.fleeDurationS,
  COOLDOWN_S: tunables.honk.cooldownS,
} as const;

export const STEER = {
  MAX_LATERAL_MPS: tunables.steer.maxLateralMps,
  RETURN_TAU_S: tunables.steer.returnTauS,
  WHEEL_MAX_DEG: tunables.steer.wheelMaxDeg,
  SENSITIVITY: tunables.steer.sensitivity,
} as const;
