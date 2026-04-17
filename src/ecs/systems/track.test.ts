/**
 * Pure logic tests for the track generator. No R3F, no koota — just
 * verifying that the generator emits a coherent descending, twisting,
 * deterministic sequence.
 */
import { describe, expect, it } from 'vitest';
import { endPose, generateTrack } from './track';

describe('generateTrack', () => {
  it('is deterministic for a given seed', () => {
    const a = generateTrack(42);
    const b = generateTrack(42);
    expect(a).toEqual(b);
  });

  it('differs between seeds', () => {
    const a = generateTrack(1);
    const b = generateTrack(2);
    expect(a[0]?.archetype.id).not.toBe(undefined);
    // Not rigorous but a quick smoke — at least one of the first 10 pieces
    // should diverge between seeds.
    const diverged = a.slice(0, 10).some((seg, i) => seg.archetype.id !== b[i]?.archetype.id);
    expect(diverged).toBe(true);
  });

  it('emits the configured runLength pieces', () => {
    const track = generateTrack(7);
    expect(track.length).toBe(80);
  });

  it('starts at the origin with zero heading', () => {
    const [first] = generateTrack(99);
    // Start is slightly elevated so the slab clears the arena ground plane.
    expect(first?.startPose).toEqual({ x: 0, y: 0.5, z: 0, yaw: 0, pitch: 0 });
    expect(first?.distanceStart).toBe(0);
  });

  it('chains segments: each piece starts where the previous ended', () => {
    const track = generateTrack(12);
    for (let i = 1; i < track.length; i++) {
      const prev = track[i - 1]!;
      const curr = track[i]!;
      expect(curr.startPose).toEqual(prev.endPose);
      expect(curr.distanceStart).toBeCloseTo(prev.distanceStart + prev.archetype.length, 6);
    }
  });

  it('makes overall downward progress (net pitch is negative)', () => {
    // Run a handful of seeds — the archetype weights bias toward dip/plunge
    // over climb, so track Y should consistently end BELOW the start.
    for (const seed of [1, 42, 1000, 9999]) {
      const track = generateTrack(seed);
      const last = track[track.length - 1]!;
      expect(last.endPose.y).toBeLessThan(0);
    }
  });

  it('winds in both directions (yaw range spans positive and negative)', () => {
    // Across 80 pieces with both left/right archetypes weighted equally,
    // the integrated yaw should visit both signs.
    const track = generateTrack(123);
    const yaws = track.map((s) => s.endPose.yaw);
    const min = Math.min(...yaws);
    const max = Math.max(...yaws);
    expect(min).toBeLessThan(0);
    expect(max).toBeGreaterThan(0);
  });
});

describe('endPose', () => {
  it('advances -Z for a straight piece', () => {
    const end = endPose(
      { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
      { id: 's', label: 's', length: 10, deltaYaw: 0, deltaPitch: 0, bank: 0, weight: 1 },
    );
    expect(end.x).toBeCloseTo(0, 6);
    expect(end.y).toBeCloseTo(0, 6);
    expect(end.z).toBeCloseTo(-10, 6);
  });

  it('integrates yaw so a 90° right turn lands on +X-forward', () => {
    const end = endPose(
      { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
      {
        id: 'r',
        label: 'r',
        length: 10,
        deltaYaw: Math.PI / 2,
        deltaPitch: 0,
        bank: 0,
        weight: 1,
      },
    );
    // Right turn rotates forward vector from -Z toward -X. At 45° midpoint:
    // forwardX = -sin(π/4) ≈ -0.707, forwardZ = -cos(π/4) ≈ -0.707
    // so end is roughly (-7.07, 0, -7.07)
    expect(end.x).toBeCloseTo(-Math.SQRT2 * 5, 5);
    expect(end.z).toBeCloseTo(-Math.SQRT2 * 5, 5);
    expect(end.yaw).toBeCloseTo(Math.PI / 2, 6);
  });

  it('integrates pitch so a descending piece ends lower than it started', () => {
    const end = endPose(
      { x: 0, y: 10, z: 0, yaw: 0, pitch: 0 },
      {
        id: 'd',
        label: 'd',
        length: 10,
        deltaYaw: 0,
        deltaPitch: -0.5,
        bank: 0,
        weight: 1,
      },
    );
    expect(end.y).toBeLessThan(10);
  });
});
