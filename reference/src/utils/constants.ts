/**
 * TRACK, SPEED, STEER, HONK expose tunables() values at call time.
 * They retain the original shape so all existing call sites keep working.
 * The function-based approach avoids circular deps (config → constants → config).
 */

import { tunables } from '@/config/index';

export const TRACK = {
  get LANE_COUNT() {
    return tunables().track.laneCount;
  },
  get LANE_WIDTH() {
    return tunables().track.laneWidth;
  },
  get WIDTH() {
    return this.LANE_COUNT * this.LANE_WIDTH;
  },
  get HALF_WIDTH() {
    return this.WIDTH / 2;
  },
  /** World-space lateral clamp on player position. */
  get LATERAL_CLAMP() {
    return this.WIDTH / 2 - 0.5;
  },
  get CHUNK_LENGTH() {
    return tunables().track.chunkLength;
  },
  get LOOKAHEAD_CHUNKS() {
    return tunables().track.lookaheadChunks;
  },
  BEHIND_CHUNKS: 3,
};

/** Index of each lane's center X, in the order [-halfWidth → +halfWidth]. */
export function laneCenterX(laneIndex: number): number {
  const half = (TRACK.LANE_COUNT - 1) / 2;
  return (laneIndex - half) * TRACK.LANE_WIDTH;
}

export const SPEED = {
  get BASE_MPS() {
    return tunables().speed.base;
  },
  get CRUISE_MPS() {
    return tunables().speed.cruise;
  },
  get BOOST_MPS() {
    return tunables().speed.boost;
  },
  get MEGA_BOOST_MPS() {
    return tunables().speed.mega;
  },
  get CRASH_DAMPING() {
    return tunables().speed.crashDamping;
  },
  get BOOST_DURATION_S() {
    return tunables().speed.boostDuration;
  },
  get MEGA_DURATION_S() {
    return tunables().speed.megaDuration;
  },
};

export const STEER = {
  get MAX_LATERAL_MPS() {
    return tunables().steer.maxLateralMps;
  },
  get RETURN_TAU_S() {
    return tunables().steer.returnTau;
  },
  get WHEEL_MAX_DEG() {
    return tunables().steer.wheelMaxDeg;
  },
  get SENSITIVITY() {
    return tunables().steer.sensitivity;
  },
};

export const ZONES = [
  { id: 'midway-strip', name: 'The Midway Strip', start: 0, length: 450 },
  { id: 'balloon-alley', name: 'Balloon Alley', start: 450, length: 450 },
  { id: 'ring-of-fire', name: 'Ring of Fire', start: 900, length: 450 },
  { id: 'funhouse-frenzy', name: 'Funhouse Frenzy', start: 1350, length: 450 },
] as const;

export type ZoneId = (typeof ZONES)[number]['id'];

export const COLORS = {
  RED: '#e53935',
  YELLOW: '#ffd600',
  BLUE: '#1e88e5',
  PURPLE: '#8e24aa',
  ORANGE: '#f36f21',
  NIGHT: '#0b0f1a',
} as const;

export const OBSTACLE_TYPES = ['barrier', 'cones', 'gate', 'oil', 'hammer', 'critter'] as const;
export type ObstacleType = (typeof OBSTACLE_TYPES)[number];

/** Static tuple — used for the CritterKind type. Runtime list comes from tunables().critters.kinds. */
export const CRITTER_KINDS = ['cow', 'horse', 'llama', 'pig'] as const;
export type CritterKind = (typeof CRITTER_KINDS)[number];

/** Runtime critter kinds list (may be overridden by tunables). */
export function critterKinds(): readonly string[] {
  return tunables().critters.kinds;
}

export const HONK = {
  get SCARE_RADIUS_M() {
    return tunables().honk.scareRadius;
  },
  get FLEE_LATERAL_M() {
    return tunables().honk.fleeLateral;
  },
  get FLEE_DURATION_S() {
    return tunables().honk.fleeDuration;
  },
  get COOLDOWN_S() {
    return tunables().honk.cooldown;
  },
};

export const PICKUP_TYPES = ['boost', 'ticket', 'mega'] as const;
export type PickupType = (typeof PICKUP_TYPES)[number];
