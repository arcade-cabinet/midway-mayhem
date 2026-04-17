/**
 * Given a list of generated segments (ordered by distanceStart) and a
 * distance `d` along the track's centerline, return the world pose at
 * that distance: position + yaw + pitch.
 *
 * This is how the car "reads" the track — we don't move the car; we
 * snapshot the track pose at the player's current distance and use it
 * to offset the world so that pose lines up with the static cockpit at
 * the origin.
 */
import type { Pose } from './track';
import { integratePose } from './track';

export interface SampledSegment {
  startPose: Pose;
  archetypeId: string;
  length: number;
  deltaYaw: number;
  deltaPitch: number;
  bank: number;
  distanceStart: number;
}

export function sampleTrackPose(segments: SampledSegment[], distance: number): Pose {
  if (segments.length === 0) {
    return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  }
  // Clamp to track range.
  const first = segments[0];
  if (!first) return { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
  if (distance < first.distanceStart) return first.startPose;
  const last = segments[segments.length - 1];
  if (!last) return first.startPose;
  const lastEnd = last.distanceStart + last.length;
  if (distance >= lastEnd) {
    // Integrate the last piece at t=1.
    return integratePose(
      last.startPose,
      {
        id: last.archetypeId,
        label: last.archetypeId,
        length: last.length,
        deltaYaw: last.deltaYaw,
        deltaPitch: last.deltaPitch,
        bank: last.bank,
        weight: 1,
      },
      1,
    );
  }
  // Binary search for the segment containing `distance`.
  let lo = 0;
  let hi = segments.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    const midSeg = segments[mid];
    if (!midSeg) break;
    if (midSeg.distanceStart <= distance) lo = mid;
    else hi = mid - 1;
  }
  const seg = segments[lo];
  if (!seg) return first.startPose;
  const t = (distance - seg.distanceStart) / seg.length;
  return integratePose(
    seg.startPose,
    {
      id: seg.archetypeId,
      label: seg.archetypeId,
      length: seg.length,
      deltaYaw: seg.deltaYaw,
      deltaPitch: seg.deltaPitch,
      bank: seg.bank,
      weight: 1,
    },
    t,
  );
}
