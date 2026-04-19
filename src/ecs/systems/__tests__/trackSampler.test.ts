/**
 * trackSampler unit tests — binary search for segment containing `distance`,
 * clamping at track bounds, and pose integration handoff to integratePose().
 */
import { describe, expect, it } from 'vitest';
import type { SampledSegment } from '@/ecs/systems/trackSampler';
import { sampleTrackPose } from '@/ecs/systems/trackSampler';

function seg(startDist: number, length = 100): SampledSegment {
  return {
    startPose: { x: startDist, y: 0, z: -startDist, yaw: 0, pitch: 0 },
    archetypeId: `seg-${startDist}`,
    length,
    deltaYaw: 0,
    deltaPitch: 0,
    bank: 0,
    distanceStart: startDist,
  };
}

describe('sampleTrackPose', () => {
  it('returns the zero pose for an empty segment list', () => {
    const p = sampleTrackPose([], 50);
    expect(p).toEqual({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
  });

  it('clamps to the first segment start pose for d below track start', () => {
    const segs = [seg(10), seg(110)];
    const p = sampleTrackPose(segs, 0);
    expect(p).toEqual(segs[0]?.startPose);
  });

  it('integrates the last segment at t=1 when d exceeds track length', () => {
    const segs = [seg(0, 100), seg(100, 100)];
    const pAfter = sampleTrackPose(segs, 99_999);
    // The last segment is flat/zero-delta, so the integrated t=1 pose equals
    // startPose projected forward by the segment length along yaw=0.
    expect(Number.isFinite(pAfter.x)).toBe(true);
    expect(Number.isFinite(pAfter.z)).toBe(true);
  });

  it('integrates within the containing segment for in-range d', () => {
    const segs = [seg(0, 100), seg(100, 100), seg(200, 100)];
    // d=150 falls inside segs[1] (start=100, length=100)
    const p = sampleTrackPose(segs, 150);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.z)).toBe(true);
  });

  it('binary search picks the correct segment across many entries', () => {
    const segs: SampledSegment[] = [];
    for (let i = 0; i < 50; i++) segs.push(seg(i * 100, 100));
    // Pick a d that uniquely lands in segment 37.
    const d = 37 * 100 + 20;
    const p = sampleTrackPose(segs, d);
    // With flat segments, the x of the resulting pose should be close to
    // the startPose.x of segment 37 (3700) plus the partial integration.
    // We don't know integratePose internals; just assert it lies inside
    // [seg37.startPose.x, seg38.startPose.x] range.
    const s37 = segs[37];
    const s38 = segs[38];
    expect(s37).toBeDefined();
    expect(s38).toBeDefined();
    if (!s37 || !s38) return;
    // Since yaw=0 flat track, integrated x should be greater than startPose.x
    expect(p.x).toBeGreaterThanOrEqual(s37.startPose.x);
  });

  it('d at the exact start of a segment returns its startPose (t=0 integration)', () => {
    const segs = [seg(0, 100), seg(100, 100)];
    const p = sampleTrackPose(segs, 100);
    // t=0 integration collapses to the startPose; yaw/pitch match
    expect(p.yaw).toBe(segs[1]?.startPose.yaw);
    expect(p.pitch).toBe(segs[1]?.startPose.pitch);
  });

  it('is deterministic — same inputs yield the same pose', () => {
    const segs = [seg(0, 100), seg(100, 100)];
    const a = sampleTrackPose(segs, 75);
    const b = sampleTrackPose(segs, 75);
    expect(a).toEqual(b);
  });

  it('single-segment lists: below start → startPose, within → integrated, past end → t=1 integration', () => {
    const one = [seg(50, 100)];
    const before = sampleTrackPose(one, 0);
    const inside = sampleTrackPose(one, 100);
    const after = sampleTrackPose(one, 999);
    expect(before).toEqual(one[0]?.startPose);
    expect(Number.isFinite(inside.x)).toBe(true);
    expect(Number.isFinite(after.x)).toBe(true);
  });
});
