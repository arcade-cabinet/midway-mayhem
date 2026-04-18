/**
 * Zod schemas for all JSON config. JSON is the source of truth for numbers;
 * TypeScript just validates it at load time and infers types.
 */
import { z } from 'zod';

// ─── Track piece archetypes ─────────────────────────────────────────────────

export const TrackArchetypeSchema = z.object({
  /** Slug used as a dictionary key. */
  id: z.string().min(1),
  /** Human-readable label. */
  label: z.string(),
  /** Length along centerline, meters. */
  length: z.number().positive(),
  /**
   * Heading change imparted over the piece's length, radians.
   * Positive = turn right, negative = turn left, zero = straight.
   */
  deltaYaw: z.number(),
  /**
   * Pitch change over the piece, radians. Negative = descend (hill down),
   * positive = climb. Zero = flat.
   */
  deltaPitch: z.number(),
  /** Banking angle at midpoint, radians. Positive = right bank. */
  bank: z.number().default(0),
  /** Relative weight when the generator draws from this archetype. */
  weight: z.number().positive().default(1),
});

export type TrackArchetype = z.infer<typeof TrackArchetypeSchema>;

export const TrackArchetypeSetSchema = z.object({
  $schema: z.string().optional(),
  /**
   * Width of a single lane, meters. The track is this × `lanes` wide.
   */
  laneWidth: z.number().positive(),
  lanes: z.number().int().positive(),
  /**
   * Vertical clearance above track surface, for cockpit/camera mounting.
   */
  surfaceThickness: z.number().positive(),
  /** Total number of segments generated per run. */
  runLength: z.number().int().positive(),
  archetypes: z.array(TrackArchetypeSchema).min(1),
});

export type TrackArchetypeSet = z.infer<typeof TrackArchetypeSetSchema>;

// ─── Tunables ───────────────────────────────────────────────────────────────

/** Per-form-factor cockpit drop-in hoist height, metres. */
const CockpitDropHeightSchema = z.object({
  phonePortrait: z.number(),
  phoneLandscape: z.number(),
  tabletPortrait: z.number(),
  tabletLandscape: z.number(),
  desktop: z.number(),
  ultrawide: z.number(),
});

/** Plunge animation amplitude scalars. */
const CockpitPlungeSchema = z.object({
  yScalePortrait: z.number(),
  yScaleLandscape: z.number(),
  yFloorPortrait: z.number(),
  yFloorLandscape: z.number(),
  xScalePortrait: z.number(),
  xScaleLandscape: z.number(),
  rotScalePortrait: z.number(),
  rotScaleLandscape: z.number(),
  zRotScale: z.number(),
  xRotMax: z.number(),
});

const CockpitTunablesSchema = z.object({
  dropHeight: CockpitDropHeightSchema,
  plunge: CockpitPlungeSchema,
});

/** Speed targets (gameStateTick) — distinct from the legacy cruiseMps
 *  used by the isolated-test stepPlayer integrator. */
const SpeedTunablesSchema = z.object({
  cruiseMps: z.number().positive(),
  boostMps: z.number().positive(),
  megaMps: z.number().positive(),
  rampStartMps: z.number().positive(),
  rampPerMetre: z.number().positive(),
  interpResponse: z.number().positive(),
});

const ComboTunablesSchema = z.object({
  chainThresholds: z.array(z.tuple([z.number(), z.number()])),
  chainExpiryMs: z.number().positive(),
});

const DamageTunablesSchema = z.object({
  pristineThreshold: z.number(),
  dentedThreshold: z.number(),
  badThreshold: z.number(),
});

const ObstacleTunablesSchema = z.object({
  forwardRenderM: z.number().positive(),
  behindRenderM: z.number().positive(),
  nearMissLateral: z.number().positive(),
  nearMissDist: z.number().positive(),
  critterPoolSize: z.number().int().positive(),
  critterScale: z.number().positive(),
});

const RaidTunablesSchema = z.object({
  telegraphMs: z.number().positive(),
  tigerActiveMs: z.number().positive(),
  knivesActiveMs: z.number().positive(),
  cannonballActiveMs: z.number().positive(),
  cooldownMinMs: z.number().positive(),
  cooldownMaxMs: z.number().positive(),
  laneCenterSpacing: z.number().positive(),
  laneHalfWidth: z.number().positive(),
  tigerLaneRange: z.number().positive(),
  tigerAheadZ: z.number().positive(),
  tigerScale: z.number().positive(),
  knifeStartY: z.number().positive(),
  knifeAheadZ: z.number().positive(),
  knifeSpacing: z.number().positive(),
  cannonballStartX: z.number(),
  cannonballY: z.number().positive(),
  cannonballAheadZ: z.number().positive(),
  smokeDelayScale: z.number().positive(),
  smokeTrailSpeed: z.number().positive(),
  cannonballCrowdBonus: z.number().positive(),
  tigerCrowdBonusAirborne: z.number().positive(),
  tigerCrowdBonusDodge: z.number().positive(),
  tigerHitThreshold: z.number().positive(),
});

const TrickTunablesSchema = z.object({
  cleanLandingToleranceDeg: z.number().positive(),
  cleanSanityReward: z.number().positive(),
  cleanCrowdReward: z.number().positive(),
  barrelRollDuration: z.number().positive(),
  wheelieDuration: z.number().positive(),
  handstandDuration: z.number().positive(),
  spin180Duration: z.number().positive(),
  /** How far ahead (m) to sample track Y for ramp detection. */
  rampLookAheadM: z.number().positive(),
  /** Minimum Y rise over rampLookAheadM to count as a ramp (m). */
  rampYRiseThreshold: z.number().positive(),
  /** Speed must exceed this (m/s) to enter airborne window. */
  rampMinSpeedMps: z.number().positive(),
  /** Duration of the airborne window after crossing a ramp crest (ms). */
  airborneWindowMs: z.number().positive(),
  /** Minimum pointer travel (px) in a flick window to register as a trick swipe. */
  flickThresholdPx: z.number().positive(),
  /** Time window (ms) in which the flick must complete. */
  flickWindowMs: z.number().positive(),
  /** Base crowd-reaction score awarded for any clean trick landing. */
  trickScoreBase: z.number().positive(),
  /** Additional crowd-reaction per full rotation in the trick. */
  trickScorePerRot: z.number().positive(),
});

const HapticPatternSchema = z.object({
  web: z.union([z.number(), z.array(z.number())]),
});

const HapticsTunablesSchema = z.object({
  crashLight: HapticPatternSchema,
  crashHeavy: HapticPatternSchema,
  boost: HapticPatternSchema,
  megaBoost: HapticPatternSchema,
  pickupTicket: HapticPatternSchema,
  honk: HapticPatternSchema,
  gameOver: HapticPatternSchema,
  zoneTransition: HapticPatternSchema,
});

const TrackTunablesSchema = z.object({
  laneCount: z.number().int().positive(),
  laneWidthM: z.number().positive(),
  /** How far inside the track edge the plunge clamp sits. */
  lateralClampInsetM: z.number().nonnegative(),
});

const HonkTunablesSchema = z.object({
  scareRadiusM: z.number().positive(),
  fleeLateralM: z.number().positive(),
  fleeDurationS: z.number().positive(),
  cooldownS: z.number().positive(),
});

const SteerTunablesSchema = z.object({
  /** Max lateral velocity in m/s at full stick. */
  maxLateralMps: z.number().positive(),
  /** Return-to-centre time constant in seconds. */
  returnTauS: z.number().positive(),
  /** Visual steering wheel rotation limit in degrees. */
  wheelMaxDeg: z.number().positive(),
  /** Steer sensitivity multiplier. */
  sensitivity: z.number().positive(),
});

/** Numeric gameplay values for a single difficulty tier. */
const DifficultyProfileTunablesSchema = z.object({
  targetSpeedMps: z.number().positive(),
  sanityDrainMultiplier: z.number().positive(),
  rewardMultiplier: z.number().positive(),
});

/** All six difficulty tier numeric profiles. */
const DifficultyTunablesSchema = z.object({
  silly: DifficultyProfileTunablesSchema,
  kazoo: DifficultyProfileTunablesSchema,
  plenty: DifficultyProfileTunablesSchema,
  ultraHonk: DifficultyProfileTunablesSchema,
  nightmare: DifficultyProfileTunablesSchema,
  ultraNightmare: DifficultyProfileTunablesSchema,
});

export const TunablesSchema = z.object({
  $schema: z.string().optional(),
  /** Target cruise speed, m/s — for legacy stepPlayer integrator only. */
  cruiseMps: z.number().positive(),
  /** Maximum allowable steer rate, |d(steer)/dt|. */
  maxSteerRate: z.number().positive(),
  /** Acceleration response toward target speed, 1/s. */
  throttleResponse: z.number().positive(),
  /** gameStateTick speed targets + ramp. */
  speed: SpeedTunablesSchema,
  /** Cockpit animation constants, per form-factor. */
  cockpit: CockpitTunablesSchema,
  /** Combo system tuning. */
  combo: ComboTunablesSchema,
  /** Damage level thresholds. */
  damage: DamageTunablesSchema,
  /** Obstacle render/collision distances. */
  obstacles: ObstacleTunablesSchema,
  /** Raid director timings. */
  raid: RaidTunablesSchema,
  /** Trick system tuning. */
  tricks: TrickTunablesSchema,
  /** Haptic patterns. */
  haptics: HapticsTunablesSchema,
  /** Difficulty tier numeric profiles. */
  difficulty: DifficultyTunablesSchema,
  /** RNG salt for content seeding (hex: 0xbee5 = 48869). */
  rngSalt: z.number().int(),
  /** Plunge overshoot distance in metres. */
  plungeOvershootM: z.number().positive(),
  /** Plunge animation duration in seconds. */
  plungeDurationS: z.number().positive(),
  /** Drop-in intro duration in milliseconds. */
  dropDurationMs: z.number().positive(),
  /** Track geometry constants (lane count, width, clamp inset). */
  track: TrackTunablesSchema,
  /** Honk/scare radius + timing. */
  honk: HonkTunablesSchema,
  /** Steering sensitivity + return-to-centre + wheel visual. */
  steer: SteerTunablesSchema,
});

export type Tunables = z.infer<typeof TunablesSchema>;
