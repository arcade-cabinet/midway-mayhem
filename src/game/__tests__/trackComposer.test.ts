import { describe, expect, it } from 'vitest';
import { composeTrack, DEFAULT_TRACK, PIECE_SPECS, type PieceKind } from '../trackComposer';

describe('trackComposer', () => {
  it('composes a single straight piece at world origin', () => {
    const result = composeTrack(['straight'], 10);
    expect(result.placements).toHaveLength(1);
    const p = result.placements[0];
    expect(p).toBeDefined();
    if (!p) return;
    expect(p.kind).toBe('straight');
    expect(p.distanceAtStart).toBe(0);
    expect(p.length).toBe(10);
  });

  it('advances cursor by length along initial heading (-Z)', () => {
    const r = composeTrack(['straightLong', 'straightLong'], 10);
    const first = r.placements[0];
    const second = r.placements[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    if (!first || !second) return;
    // heading default is PI, so sin(PI)≈0, cos(PI)=-1 → cursor moves -Z
    // First piece origin placed so anchor is at (0,0); second piece is 2 units (*10) along -Z
    expect(second.position[2]).toBeLessThan(first.position[2]);
    expect(Math.abs(second.position[2] - first.position[2])).toBeCloseTo(20, 0);
  });

  it('records cumulative distance correctly', () => {
    const r = composeTrack(['straightLong', 'straight', 'straightLong'], 10);
    expect(r.placements[0]?.distanceAtStart).toBe(0);
    expect(r.placements[1]?.distanceAtStart).toBe(20); // 2 * 10
    expect(r.placements[2]?.distanceAtStart).toBe(30); // + 1 * 10
    expect(r.totalLength).toBe(50); // + 2 * 10
  });

  it('applies ramp z-rise', () => {
    const r = composeTrack(['rampLong'], 10);
    expect(r.endPosition[1]).toBeCloseTo(5.2, 1); // 0.52 * 10
  });

  it('applies lateral after cornerLarge and turns heading 90°', () => {
    const r = composeTrack(['cornerLarge'], 10);
    // Heading started at PI; adds 90° → 3π/2 (3.1415+1.5708 mod 2π = 4.71 mod 2π ≈ 4.71)
    const expected = (Math.PI + Math.PI / 2) % (Math.PI * 2);
    expect(r.endHeadingRad).toBeCloseTo(expected, 3);
    // Cursor moved 2 forward (old heading) then 2 lateral (new heading)
    // Total XZ distance from origin should be ~2.83 * 10 (diagonal of 2x2)
    const dx = r.endPosition[0];
    const dz = r.endPosition[2];
    const dist = Math.hypot(dx, dz);
    expect(dist).toBeCloseTo(Math.hypot(20, 20), 0);
  });

  it('DEFAULT_TRACK produces a positive-length winding course', () => {
    const r = composeTrack(DEFAULT_TRACK, 10);
    expect(r.placements.length).toBe(DEFAULT_TRACK.length);
    expect(r.totalLength).toBeGreaterThan(100); // at least 100m of track
    // All placements should have valid asset IDs
    for (const p of r.placements) {
      expect(p.assetId).toBeTruthy();
      expect(p.assetId.startsWith('road')).toBe(true);
    }
  });

  it('every PieceKind in DEFAULT_TRACK has a matching PIECE_SPEC', () => {
    for (const k of DEFAULT_TRACK) {
      expect(PIECE_SPECS[k as PieceKind]).toBeDefined();
    }
  });

  it('no placement overlaps (each piece starts after the previous)', () => {
    const r = composeTrack(DEFAULT_TRACK, 10);
    for (let i = 1; i < r.placements.length; i++) {
      const prev = r.placements[i - 1];
      const cur = r.placements[i];
      expect(prev).toBeDefined();
      expect(cur).toBeDefined();
      if (!prev || !cur) continue;
      // Each piece must start exactly where the previous one ends (no gap, no overlap)
      expect(cur.distanceAtStart).toBeGreaterThanOrEqual(prev.distanceAtStart + prev.length);
    }
  });
});
