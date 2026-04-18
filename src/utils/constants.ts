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
  NIGHT: '#0b0f1a',
} as const;

export const ZONES = [
  { id: 'midway-strip', name: 'The Midway Strip', start: 0, length: 450 },
  { id: 'balloon-alley', name: 'Balloon Alley', start: 450, length: 450 },
  { id: 'ring-of-fire', name: 'Ring of Fire', start: 900, length: 450 },
  { id: 'funhouse-frenzy', name: 'Funhouse Frenzy', start: 1350, length: 450 },
] as const;

export type ZoneId = (typeof ZONES)[number]['id'];

export const OBSTACLE_TYPES = ['barrier', 'cones', 'gate', 'oil', 'hammer', 'critter'] as const;
export type ObstacleType = (typeof OBSTACLE_TYPES)[number];

export const CRITTER_KINDS = ['cow', 'horse', 'llama', 'pig'] as const;
export type CritterKind = (typeof CRITTER_KINDS)[number];

export const PICKUP_TYPES = ['boost', 'ticket', 'mega'] as const;
export type PickupType = (typeof PICKUP_TYPES)[number];

// ─── Track geometry constants ────────────────────────────────────────────────
// TODO(Task #124): replace literals with tunables() once config system is ported.

export const TRACK = {
  LANE_COUNT: 4,
  LANE_WIDTH: 3.3,
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

// ─── Honk / critter-scare constants ─────────────────────────────────────────
// TODO(Task #124): replace literals with tunables() once config system is ported.

export const HONK = {
  SCARE_RADIUS_M: 30,
  FLEE_LATERAL_M: 6,
  FLEE_DURATION_S: 0.9,
  COOLDOWN_S: 2,
} as const;
