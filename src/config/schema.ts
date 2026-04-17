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

export const TunablesSchema = z.object({
  $schema: z.string().optional(),
  /** Target cruise speed, m/s. */
  cruiseMps: z.number().positive(),
  /** Maximum allowable steer rate, |d(steer)/dt|. */
  maxSteerRate: z.number().positive(),
  /** Acceleration response toward target speed, 1/s. */
  throttleResponse: z.number().positive(),
});

export type Tunables = z.infer<typeof TunablesSchema>;
