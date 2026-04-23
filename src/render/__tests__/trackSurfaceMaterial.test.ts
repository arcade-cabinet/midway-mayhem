/**
 * Node-level unit test for the track surface material descriptor.
 *
 * Tests the pure `buildTrackSurfaceMaterialDescriptor` function without
 * touching Three.js or the browser.  The hook (`useTrackSurfaceMaterial`)
 * calls `useTexture` which requires a real browser GPU context, so it is
 * deliberately not exercised here — visual correctness is covered by the
 * TrackPackage.browser.test.tsx screenshot harness.
 */
import { describe, expect, it } from 'vitest';
import { buildTrackSurfaceMaterialDescriptor } from '../trackSurfaceMaterial';

describe('buildTrackSurfaceMaterialDescriptor', () => {
  it('returns the three expected texture paths', () => {
    const desc = buildTrackSurfaceMaterialDescriptor();
    expect(desc.paths.diffuse).toMatch(/planks\/diffuse\.jpg$/);
    expect(desc.paths.normal).toMatch(/planks\/normal\.jpg$/);
    expect(desc.paths.roughness).toMatch(/planks\/roughness\.jpg$/);
  });

  it('all paths start with /textures/track/planks', () => {
    const desc = buildTrackSurfaceMaterialDescriptor();
    for (const path of Object.values(desc.paths)) {
      expect(path).toMatch(/^\/textures\/track\/planks\//);
    }
  });

  it('tiling is a tuple of two positive numbers', () => {
    const desc = buildTrackSurfaceMaterialDescriptor();
    expect(desc.tiling).toHaveLength(2);
    expect(desc.tiling[0]).toBeGreaterThan(0);
    expect(desc.tiling[1]).toBeGreaterThan(0);
  });

  it('roughness is between 0 and 1', () => {
    const desc = buildTrackSurfaceMaterialDescriptor();
    expect(desc.roughness).toBeGreaterThan(0);
    expect(desc.roughness).toBeLessThanOrEqual(1);
  });

  it('metalness is 0 (wood is non-metallic)', () => {
    const desc = buildTrackSurfaceMaterialDescriptor();
    expect(desc.metalness).toBe(0);
  });

  it('is stable across calls — same value returned each time', () => {
    const a = buildTrackSurfaceMaterialDescriptor();
    const b = buildTrackSurfaceMaterialDescriptor();
    expect(a).toEqual(b);
  });

  it('accepts an optional fsRoot argument without changing output', () => {
    const withRoot = buildTrackSurfaceMaterialDescriptor('/some/root');
    const withoutRoot = buildTrackSurfaceMaterialDescriptor();
    expect(withRoot).toEqual(withoutRoot);
  });
});
