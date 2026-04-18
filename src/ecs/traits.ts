/**
 * Every trait the game defines, in one file. koota traits are small structs
 * attached to entities; a query like `world.query(Player, Speed)` returns
 * every entity that has both. This file is the complete schema of the game.
 *
 * Keep each trait narrow (one concern, one struct). Compose them into
 * archetypes by attaching multiple traits in a single `world.spawn()`.
 */
import { trait } from 'koota';
import type { Difficulty } from '@/game/difficulty';
import type { PieceKind } from '@/track/trackComposer';
import type { CritterKind, ZoneId } from '@/utils/constants';

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

/**
 * Six obstacle types per vision spec:
 *  - barrier: unbreakable block, swerve around it
 *  - cone:    stack of traffic cones, minor damage
 *  - gate:    gap-in-the-wall that telegraphs the correct lane
 *  - oil:     slick patch, reduces steer authority for ~1s
 *  - hammer:  swinging carnival hammer, timed obstacle
 *  - critter: wandering circus animal; honk to scare it off the track (P0 vision beat)
 */
export type ObstacleKind = 'barrier' | 'cone' | 'gate' | 'oil' | 'hammer' | 'critter';
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
  /** For critter obstacles: which animal to render. Empty string for non-critters. */
  critterKind: '' as CritterKind | '',
  /** For critter obstacles: performance.now() when honk scared this critter; 0 = not fleeing. */
  fleeStartedAt: 0,
  /** For critter obstacles: flee direction (-1 = left, 0 = idle, 1 = right). */
  fleeDir: 0 as -1 | 0 | 1,
  /** For hammer obstacles: initial swing phase offset (radians) so hammers animate out-of-sync. */
  swingPhase: 0,
});

/**
 * Three pickup types per vision spec:
 *  - balloon: +100 score, small flourish.
 *  - boost:   +2.5s speed boost to BOOST cap.
 *  - mega:    +3.5s speed boost to MEGA cap; rarer than boost.
 */
export type PickupKind = 'balloon' | 'boost' | 'mega';
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

// ─── Zones ──────────────────────────────────────────────────────────────────

export type ZoneTheme = 'carnival' | 'funhouse' | 'ringmaster' | 'grandfinale';

/** A zone banner anchored at a specific distance along the track. Renderer
 *  samples the track pose at `distance` and plants tapered banner meshes on
 *  each edge with the theme text printed via canvas texture. */
export const Zone = trait({
  theme: 'carnival' as ZoneTheme,
  distance: 0,
});

// ─── Full run state (replaces zustand useGameStore) ──────────────────────────

/**
 * Run session metadata. Attached to the singleton player entity at startRun.
 * Replaces the top-level session fields in the reference useGameStore.
 *
 * NOTE: RunPlan and OptimalPath are complex objects that koota traits cannot
 * hold (koota only supports primitives). They are stored in module-level refs
 * in gameState.ts and exposed via readState(). This trait only stores the
 * scalar session metadata.
 */
export const RunSession = trait({
  running: false,
  paused: false,
  gameOver: false,
  startedAt: 0,
  seed: 0,
  difficulty: 'kazoo' as Difficulty,
  /** Human-readable phrase the seed came from, if any. Stored as '' when null. */
  seedPhrase: '',
  /** Effective permadeath flag. */
  permadeath: false,
});

/**
 * Per-frame gameplay quantities that change every tick.
 * `hype` = speed-as-percent, `sanity` = health-like (0..100), `crowdReaction` = score.
 */
export const GameplayStats = trait({
  distance: 0,
  lateral: 0,
  speedMps: 0,
  targetSpeedMps: 0,
  steer: 0,
  /** 1 = auto-accelerate; 0 = coast. */
  throttle: 1,
  hype: 0,
  sanity: 100,
  crowdReaction: 0,
  crashes: 0,
  currentZone: 'midway-strip' as ZoneId,
  /** Racing-line cleanliness [0..1]. */
  cleanliness: 1,
});

/** Boost / mega-boost expiry timestamps (performance.now() epoch). */
export const BoostState = trait({
  boostUntil: 0,
  megaBoostUntil: 0,
});

/** Drop-in intro progress. `dropProgress` goes 0→1 over DROP_DURATION_MS. */
export const DropIntro = trait({
  dropProgress: 0,
  dropStartedAt: 0,
});

/** Plunge state — player drove off side of a rail-free ramp. */
export const PlungeState = trait({
  plunging: false,
  plungeStartedAt: 0,
  plungeDirection: 0,
  currentPieceKind: null as PieceKind | null,
});

/** Trick / airborne state. */
export const TrickState = trait({
  airborne: false,
  trickActive: false,
  trickRotationY: 0,
  trickRotationZ: 0,
});

/** Per-run achievement counters. Reset at startRun. */
export const RunCounters = trait({
  scaresThisRun: 0,
  maxComboThisRun: 0,
  raidsSurvived: 0,
  ticketsThisRun: 0,
});

/** Photo mode flag. */
export const PhotoMode = trait({ active: false });
