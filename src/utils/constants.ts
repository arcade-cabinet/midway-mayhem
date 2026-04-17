export const TRACK = {
  LANE_COUNT: 3,
  LANE_WIDTH: 3.3, // 3 lanes × 3.3m = ~10m track width (matches Kenney scale=10 pieces)
  get WIDTH() {
    return this.LANE_COUNT * this.LANE_WIDTH;
  },
  get HALF_WIDTH() {
    return (this.LANE_COUNT * this.LANE_WIDTH) / 2;
  },
  /** World-space lateral clamp on player position. */
  get LATERAL_CLAMP() {
    return (this.LANE_COUNT * this.LANE_WIDTH) / 2 - 0.5;
  },
  CHUNK_LENGTH: 40,
  LOOKAHEAD_CHUNKS: 20,
  BEHIND_CHUNKS: 3,
} as const;

/** Index of each lane's center X, in the order [-halfWidth → +halfWidth]. */
export function laneCenterX(laneIndex: number): number {
  const half = (TRACK.LANE_COUNT - 1) / 2;
  return (laneIndex - half) * TRACK.LANE_WIDTH;
}

export const SPEED = {
  BASE_MPS: 30,
  CRUISE_MPS: 70,
  BOOST_MPS: 90,
  MEGA_BOOST_MPS: 120,
  CRASH_DAMPING: 0.55,
  BOOST_DURATION_S: 2.2,
  MEGA_DURATION_S: 3.5,
} as const;

export const STEER = {
  MAX_LATERAL_MPS: 18,
  RETURN_TAU_S: 0.25,
  WHEEL_MAX_DEG: 35,
  SENSITIVITY: 1.0,
} as const;

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

export const OBSTACLE_TYPES = ['barrier', 'cones', 'gate', 'oil', 'hammer'] as const;
export type ObstacleType = (typeof OBSTACLE_TYPES)[number];

export const PICKUP_TYPES = ['boost', 'ticket', 'mega'] as const;
export type PickupType = (typeof PICKUP_TYPES)[number];
