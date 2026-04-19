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

// ─── Track / honk / steer — now sourced from tunables.json ──────────────────
// These used to be literals here; the source of truth moved to
// src/config/tunables.json so they're tunable without a code change.
// The TRACK / HONK / STEER uppercase-keyed objects are preserved for
// backwards compatibility with existing import sites — but the runtime
// values come from the typed config.
import { tunables } from '@/config';

export const TRACK = {
  LANE_COUNT: tunables.track.laneCount,
  LANE_WIDTH: tunables.track.laneWidth,
  get WIDTH() {
    return this.LANE_COUNT * this.LANE_WIDTH;
  },
  get HALF_WIDTH() {
    return this.WIDTH / 2;
  },
  get LATERAL_CLAMP() {
    return this.WIDTH / 2 - 0.5;
  },
} as const;

/** World-space X for the centre of a given lane index (0 = leftmost). */
export function laneCenterX(laneIndex: number): number {
  const half = (TRACK.LANE_COUNT - 1) / 2;
  return (laneIndex - half) * TRACK.LANE_WIDTH;
}

export const HONK = {
  SCARE_RADIUS_M: tunables.honk.scareRadiusM,
  FLEE_LATERAL_M: tunables.honk.fleeLateralM,
  FLEE_DURATION_S: tunables.honk.fleeDurationS,
  COOLDOWN_S: tunables.honk.cooldownS,
} as const;

export const STEER = {
  /** Maximum lateral velocity in m/s at full steer input. */
  MAX_LATERAL_MPS: tunables.steer.maxLateralMps,
  /** Steering return time constant (seconds). */
  RETURN_TAU_S: tunables.steer.returnTauS,
  /** Visual steering wheel rotation limit in degrees. */
  WHEEL_MAX_DEG: tunables.steer.wheelMaxDeg,
  /** Steer sensitivity multiplier. */
  SENSITIVITY: tunables.steer.sensitivity,
} as const;
