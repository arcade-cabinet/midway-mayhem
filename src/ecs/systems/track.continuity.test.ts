/**
 * Guarantees: for every adjacent pair of generated segments, segment[i]'s
 * endPose must equal segment[i+1]'s startPose (within FP tolerance). If this
 * ever fails, the generator has a bug and the track is visibly broken.
 */
import { describe, expect, it } from 'vitest';
import { endPose, generateTrack } from './track';

function poseEq(
  a: ReturnType<typeof endPose>,
  b: ReturnType<typeof endPose>,
  tol = 1e-9,
): boolean {
  return (
    Math.abs(a.x - b.x) < tol &&
    Math.abs(a.y - b.y) < tol &&
    Math.abs(a.z - b.z) < tol &&
    Math.abs(a.yaw - b.yaw) < tol &&
    Math.abs(a.pitch - b.pitch) < tol
  );
}

describe('generator continuity', () => {
  for (const seed of [42, 7, 1337]) {
    it(`seed ${seed}: endPose[i] === startPose[i+1]`, () => {
      const segs = generateTrack(seed);
      for (let i = 0; i < segs.length - 1; i++) {
        const cur = segs[i];
        const next = segs[i + 1];
        if (!cur || !next) throw new Error('generator returned undefined segment');
        const continuous = poseEq(cur.endPose, next.startPose);
        if (!continuous) {
          throw new Error(
            `seed ${seed} discontinuity at i=${i}: ` +
              `${cur.archetype.id} end (${cur.endPose.x.toFixed(3)}, ${cur.endPose.y.toFixed(3)}, ${cur.endPose.z.toFixed(3)}) → ` +
              `${next.archetype.id} start (${next.startPose.x.toFixed(3)}, ${next.startPose.y.toFixed(3)}, ${next.startPose.z.toFixed(3)})`,
          );
        }
        expect(continuous).toBe(true);
      }
    });
  }
});
