/**
 * Track generation + geometry.
 *
 * Input:  seed + archetype JSON (src/config/archetypes/track-pieces.json)
 * Output: `runLength` TrackSegment entities, each with its archetype slug
 *         and its cumulative starting distance/yaw/pitch — enough info for
 *         a renderer to know where to draw the piece.
 *
 * Deterministic: same seed always produces the same track.
 */
import type { World } from 'koota';
import { type TrackArchetype, trackArchetypes } from '@/config';
import { LaneCount, TrackSegment } from '@/ecs/traits';
import { createRng } from '@/utils/rng';

export interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** Pure function used by both generation + rendering. No side effects. */
export function integratePose(start: Pose, archetype: TrackArchetype, t: number): Pose {
  // t ∈ [0, 1]: position along the piece
  const yaw = start.yaw + archetype.deltaYaw * t;
  const pitch = start.pitch + archetype.deltaPitch * t;
  // Advance along the local forward vector (+X as forward under yaw=0 would
  // clash with the R3F convention of -Z-forward, so we follow -Z here).
  const stepLen = archetype.length * t;
  // Average yaw/pitch across [0, t] for a rough centerline — accurate enough
  // for rendering tessellated segments later.
  const midYaw = start.yaw + (archetype.deltaYaw * t) / 2;
  const midPitch = start.pitch + (archetype.deltaPitch * t) / 2;
  const forwardX = -Math.sin(midYaw) * Math.cos(midPitch);
  const forwardY = Math.sin(midPitch);
  const forwardZ = -Math.cos(midYaw) * Math.cos(midPitch);
  return {
    x: start.x + forwardX * stepLen,
    y: start.y + forwardY * stepLen,
    z: start.z + forwardZ * stepLen,
    yaw,
    pitch,
  };
}

/** End-of-segment pose given its start pose. */
export function endPose(start: Pose, archetype: TrackArchetype): Pose {
  return integratePose(start, archetype, 1);
}

export interface GeneratedSegment {
  index: number;
  archetype: TrackArchetype;
  distanceStart: number;
  startPose: Pose;
  endPose: Pose;
}

/**
 * Pitch is clamped tight so the descent reads as a gentle coil, not a
 * free-fall. Average descent angle for ~50m over 80×~22m pieces is only
 * ~1.6°; the clamp at ~3.4° (0.06 rad) gives plunge sections room without
 * letting the integrator pin against the rail.
 */
const PITCH_MAX = 0.06;
const PITCH_MIN = -0.06;

/**
 * Per-zone weight multipliers applied on top of the archetype JSON weights.
 * Zone 1 (pieces 0-19) is the tutorial space — flat, almost no descent.
 * Zones 2-4 progressively favor descent pieces and disable climb so the
 * cumulative Y is monotonically non-increasing.
 *
 * See docs/ARCHITECTURE.md "Run elevation profile" for the target shape.
 */
type ArchetypeId =
  | 'straight'
  | 'slight-left'
  | 'slight-right'
  | 'hard-left'
  | 'hard-right'
  | 'dip'
  | 'climb'
  | 'plunge';

const ZONE_WEIGHT_MULTIPLIERS: Record<number, Partial<Record<ArchetypeId, number>>> = {
  // Zone 1 — Midway Strip: nearly flat tutorial. No descent pieces.
  0: { straight: 3, dip: 0, plunge: 0, climb: 0 },
  // Zone 2 — Balloon Alley: gentle descent — straights still dominate.
  1: { straight: 2, dip: 0.6, plunge: 0, climb: 0 },
  // Zone 3 — Ring of Fire: moderate descent. Some plunges, mostly straights.
  2: { straight: 1.8, dip: 0.7, plunge: 0.3, climb: 0 },
  // Zone 4 — Funhouse Frenzy: final coil. Most descent of any zone.
  3: { straight: 1.2, dip: 0.9, plunge: 0.5, climb: 0 },
};

function zoneIndexFor(pieceIndex: number, runLength: number): number {
  // 4 equal-size zones across the run.
  const zoneSize = runLength / 4;
  return Math.min(3, Math.floor(pieceIndex / zoneSize));
}

/** Pure generator — for tests + for the world-seeding system. */
export function generateTrack(seed: number): GeneratedSegment[] {
  const rng = createRng(seed);
  const archetypes = trackArchetypes.archetypes;
  const baseWeights = archetypes.map((a) => a.weight);
  const segments: GeneratedSegment[] = [];

  // Precompute per-zone effective weights + the straight-fallback archetype
  // once, outside the per-piece loop. Before: every iteration re-allocated
  // a weight array and scanned archetypes for 'straight'.
  const weightsByZone: number[][] = [0, 1, 2, 3].map((zone) => {
    const multipliers = ZONE_WEIGHT_MULTIPLIERS[zone] ?? {};
    return archetypes.map((a, idx) => {
      const mul = multipliers[a.id as ArchetypeId];
      return baseWeights[idx]! * (mul ?? 1);
    });
  });
  const straightFallback = archetypes.find((a) => a.id === 'straight');

  // Start elevated so the track slab (thickness ~0.45m + curb height ~0.18m)
  // clears the ground plane at y=-4 with room for the camera's ground-level
  // POV to sit just above the track surface, not below it.
  let startPose: Pose = { x: 0, y: 0.5, z: 0, yaw: 0, pitch: 0 };
  let distanceStart = 0;

  for (let i = 0; i < trackArchetypes.runLength; i++) {
    const zone = zoneIndexFor(i, trackArchetypes.runLength);
    const zoneWeights = weightsByZone[zone]!;

    // Draw an archetype, but if the resulting pitch would breach the band,
    // substitute a reasonable correction.
    let archetype = rng.weightedPick(archetypes, zoneWeights);
    const predicted = startPose.pitch + archetype.deltaPitch;
    if (predicted > PITCH_MAX || predicted < PITCH_MIN) {
      // Far too steep in whichever direction — swap to a straight so the
      // accumulated pitch holds its current value instead of compounding.
      archetype = straightFallback ?? archetype;
    }
    const finish = endPose(startPose, archetype);
    segments.push({
      index: i,
      archetype,
      distanceStart,
      startPose,
      endPose: finish,
    });
    startPose = finish;
    distanceStart += archetype.length;
  }

  return segments;
}

/**
 * Spawn TrackSegment entities into the world from a seed. Idempotent-ish
 * via the world — callers should clear any prior track entities first.
 */
export function seedTrack(world: World, seed: number): void {
  for (const seg of generateTrack(seed)) {
    world.spawn(
      TrackSegment({
        index: seg.index,
        archetype: seg.archetype.id,
        distanceStart: seg.distanceStart,
        length: seg.archetype.length,
        deltaYaw: seg.archetype.deltaYaw,
        deltaPitch: seg.archetype.deltaPitch,
        bank: seg.archetype.bank,
        startX: seg.startPose.x,
        startY: seg.startPose.y,
        startZ: seg.startPose.z,
        startYaw: seg.startPose.yaw,
        startPitch: seg.startPose.pitch,
      }),
      LaneCount({ value: trackArchetypes.lanes }),
    );
  }
}
