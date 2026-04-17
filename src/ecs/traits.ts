/**
 * Every trait the game defines, in one file. koota traits are small structs
 * attached to entities; a query like `world.query(Player, Speed)` returns
 * every entity that has both. This file is the complete schema of the game.
 *
 * Keep each trait narrow (one concern, one struct). Compose them into
 * archetypes by attaching multiple traits in a single `world.spawn()`.
 */
import { trait } from 'koota';

// ─── Session / run state ────────────────────────────────────────────────────

/** Top-level run state. There is at most one entity with this trait. */
export const RunSession = trait({
  running: false,
  gameOver: false,
  startedAtMs: 0,
  seed: 0,
});

// ─── Player ─────────────────────────────────────────────────────────────────

/** Marker trait for the player entity. */
export const Player = trait();

/** Meters-per-second scalar. Attached to whatever moves along the track. */
export const Speed = trait({ value: 0, target: 0 });

/** Driver input: lateral steer [-1, +1] + throttle gate [0, 1]. */
export const Steer = trait({ value: 0 });
export const Throttle = trait({ value: 1 });

/** Progress along the track (meters) and lateral offset from centerline. */
export const Position = trait({ distance: 0, lateral: 0 });

// ─── Track ──────────────────────────────────────────────────────────────────

/**
 * One contiguous piece of track. The track is a flat list of these entities
 * in order (their `.index`).
 */
export const TrackSegment = trait({
  index: 0,
  /** Archetype slug (see src/config/archetypes/track-pieces.json). */
  archetype: 'straight',
  /** Starting distance in meters from run origin. */
  distanceStart: 0,
  /** Length in meters along the centerline. */
  length: 0,
  /** Cumulative heading rotation (radians) induced by this piece. */
  deltaYaw: 0,
  /** Cumulative pitch change (radians) — for hills/dips. */
  deltaPitch: 0,
  /** Lateral banking angle at piece midpoint (radians). */
  bank: 0,
  /** Start pose, produced by the generator and stored verbatim so the
   *  renderer never has to re-integrate. Re-integration in the renderer was
   *  a source of drift that became a visible seam over 80 pieces. */
  startX: 0,
  startY: 0,
  startZ: 0,
  startYaw: 0,
  startPitch: 0,
});

/** Lane count on this segment. Separate trait so straights can inherit. */
export const LaneCount = trait({ value: 4 });

// ─── Obstacles + pickups ────────────────────────────────────────────────────

export type ObstacleKind = 'cone' | 'oil';
/**
 * Obstacle sitting on the track. Collision check compares the player's
 * Position (distance + lateral) against the obstacle's distance + lateral.
 */
export const Obstacle = trait({
  kind: 'cone' as ObstacleKind,
  distance: 0,
  lateral: 0,
  /** Set to true once player has hit this obstacle, so we don't re-trigger. */
  consumed: false,
});

export type PickupKind = 'balloon' | 'boost';
/**
 * Collectible or buff pickup. Balloons grant score; boosts grant temporary
 * speed cap increase. `consumed` gates double-fire.
 */
export const Pickup = trait({
  kind: 'balloon' as PickupKind,
  distance: 0,
  lateral: 0,
  consumed: false,
});

// ─── Scoring + status ───────────────────────────────────────────────────────

export const Score = trait({
  value: 0,
  balloons: 0,
  /** Non-zero while a boost pad is active; counts down each frame. */
  boostRemaining: 0,
  /** Hits taken (cones + oil). 3+ ends the run. */
  damage: 0,
  /** Seconds of clean driving since last hit — feeds the combo multiplier. */
  cleanSeconds: 0,
});
