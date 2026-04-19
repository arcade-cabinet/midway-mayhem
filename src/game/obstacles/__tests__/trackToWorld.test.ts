/**
 * trackToWorld unit tests — distance + lateral → world-space conversion.
 * Feeds real composeTrack output so coverage reflects real geometry.
 */
import { describe, expect, it } from 'vitest';
import { trackToWorld } from '@/game/obstacles/trackToWorld';
import { composeTrack, type PieceKind } from '@/track/trackComposer';

describe('trackToWorld', () => {
  const straightKinds: PieceKind[] = ['straight', 'straight', 'straight', 'straight'];

  it('returns origin fallback when composition is empty', () => {
    const empty = {
      placements: [],
      totalLength: 0,
      endPosition: [0, 0, 0] as [number, number, number],
      endHeadingRad: 0,
    };
    const p = trackToWorld(empty as unknown as ReturnType<typeof composeTrack>, 10, 0);
    expect(p).toEqual({ x: 0, y: 0, z: 0, heading: 0 });
  });

  it('moves forward as d increases on a straight track (z decreases)', () => {
    const c = composeTrack(straightKinds, 10);
    const a = trackToWorld(c, 0, 0);
    const b = trackToWorld(c, 20, 0);
    expect(b.z).toBeLessThan(a.z);
  });

  it('y (elevation) stays flat on a pure-straight composition', () => {
    const c = composeTrack(straightKinds, 10);
    const a = trackToWorld(c, 0, 0);
    const b = trackToWorld(c, 30, 0);
    expect(a.y).toBe(b.y);
  });

  it('clamps to the last placement when d exceeds totalLength', () => {
    const c = composeTrack(straightKinds, 10);
    const end = trackToWorld(c, c.totalLength + 1000, 0);
    expect(Number.isFinite(end.x)).toBe(true);
    expect(Number.isFinite(end.z)).toBe(true);
  });

  it('positive lateral offset shifts perpendicular to heading', () => {
    const c = composeTrack(straightKinds, 10);
    const center = trackToWorld(c, 10, 0);
    const right = trackToWorld(c, 10, 3);
    const left = trackToWorld(c, 10, -3);
    // On a straight piece, moving +lateral then -lateral should be symmetric around centre.
    const midX = (right.x + left.x) / 2;
    const midZ = (right.z + left.z) / 2;
    expect(midX).toBeCloseTo(center.x, 5);
    expect(midZ).toBeCloseTo(center.z, 5);
  });

  it('lateral offset preserves y', () => {
    const c = composeTrack(straightKinds, 10);
    const a = trackToWorld(c, 10, 0);
    const b = trackToWorld(c, 10, 5);
    expect(a.y).toBe(b.y);
  });

  it('heading matches the underlying placement.rotationY', () => {
    const c = composeTrack(straightKinds, 10);
    const placement = c.placements[0];
    expect(placement).toBeDefined();
    const w = trackToWorld(c, 0, 0);
    expect(w.heading).toBe(placement?.rotationY);
  });

  it('is deterministic for identical inputs', () => {
    const c = composeTrack(straightKinds, 10);
    const a = trackToWorld(c, 15, 1.5);
    const b = trackToWorld(c, 15, 1.5);
    expect(a).toEqual(b);
  });

  it('distance=0 lateral=0 lands at the seam of the first piece', () => {
    const c = composeTrack(straightKinds, 10);
    const w = trackToWorld(c, 0, 0);
    // Cursor anchor (x=0, z=0) convention → x and z should be finite and on the seam.
    expect(Number.isFinite(w.x)).toBe(true);
    expect(Number.isFinite(w.z)).toBe(true);
  });

  it('monotonic z (forward motion) on adjacent pieces with the same heading', () => {
    const c = composeTrack(straightKinds, 10);
    // Points near the end of piece 0 and start of piece 1.
    const before = trackToWorld(c, 9, 0);
    const after = trackToWorld(c, 11, 0);
    expect(after.z).toBeLessThan(before.z);
  });
});
