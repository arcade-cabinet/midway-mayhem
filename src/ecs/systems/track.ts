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
import { trackArchetypes, type TrackArchetype } from '@/config';
import { LaneCount, TrackSegment } from '@/ecs/traits';
import { Rng } from '@/utils/rng';

export interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** Pure function used by both generation + rendering. No side effects. */
export function integratePose(
  start: Pose,
  archetype: TrackArchetype,
  t: number,
): Pose {
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
 * Pitch is clamped to this band so the track can't loop over on itself or
 * hand you an upside-down section. About 46°, plenty for a steep Hot Wheels
 * descent, not enough to violate "gravity is down".
 */
const PITCH_MAX = 0.8;
const PITCH_MIN = -0.8;

/** Pure generator — for tests + for the world-seeding system. */
export function generateTrack(seed: number): GeneratedSegment[] {
  const rng = new Rng(seed);
  const archetypes = trackArchetypes.archetypes;
  const weights = archetypes.map((a) => a.weight);
  const segments: GeneratedSegment[] = [];

  // Start elevated so the track slab (thickness ~0.45m + curb height ~0.18m)
  // clears the ground plane at y=-4 with room for the camera's ground-level
  // POV to sit just above the track surface, not below it.
  let startPose: Pose = { x: 0, y: 0.5, z: 0, yaw: 0, pitch: 0 };
  let distanceStart = 0;

  for (let i = 0; i < trackArchetypes.runLength; i++) {
    // Draw an archetype, but if the resulting pitch would breach the band,
    // substitute a reasonable correction.
    let archetype = rng.weightedPick(archetypes, weights);
    const predicted = startPose.pitch + archetype.deltaPitch;
    if (predicted > PITCH_MAX || predicted < PITCH_MIN) {
      // Far too steep in whichever direction — swap to a straight so the
      // accumulated pitch holds its current value instead of compounding.
      archetype = archetypes.find((a) => a.id === 'straight') ?? archetype;
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
