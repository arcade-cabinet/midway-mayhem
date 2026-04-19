/**
 * cockpitBlueprint unit tests — validates that the Blender-exported
 * blueprint JSON parses cleanly against CockpitBlueprintSchema and that
 * the shape contains every element the R3F port (#154) needs.
 */
import { describe, expect, it } from 'vitest';
import { cockpitBlueprint } from '@/config';
import { CockpitBlueprintSchema } from '@/config/schema';

describe('cockpitBlueprint (parsed cockpit-blueprint.json)', () => {
  it('parses cleanly against CockpitBlueprintSchema', () => {
    expect(() => CockpitBlueprintSchema.parse(cockpitBlueprint)).not.toThrow();
  });

  it('camera matches POC-tuned spec (0, 1.72, 1.55), 88° hFov', () => {
    expect(cockpitBlueprint.cameraPosition).toEqual([0, 1.72, 1.55]);
    expect(cockpitBlueprint.cameraFov.horizontalDeg).toBe(88);
    expect(cockpitBlueprint.cameraFov.near).toBeGreaterThan(0);
    expect(cockpitBlueprint.cameraFov.far).toBeGreaterThan(1000);
  });

  it('contains every identity-signature mesh required by the cockpit hero pass', () => {
    const names = Object.keys(cockpitBlueprint.meshes);
    // Every element from project_next_pass_cockpit.md must be represented.
    for (const required of [
      'hood',
      'dashCowl',
      'pillarLeft',
      'pillarRight',
      'windshieldArch',
      'seatBase',
      'seatBack',
      'wheelRim',
      'wheelHub',
      'hornCap',
      'hornRing',
      'gaugeFace_LAUGHS',
      'gaugeFace_FUN',
      'flowerCenter',
      'flowerStem',
      'diceRed',
      'diceBlue',
      'mirrorFrame',
      'mirrorGlass',
    ]) {
      expect(names, `missing ${required}`).toContain(required);
    }
  });

  it('every mesh references a real material in the materials table', () => {
    const materialIds = new Set(Object.keys(cockpitBlueprint.materials));
    for (const [name, mesh] of Object.entries(cockpitBlueprint.meshes)) {
      expect(materialIds.has(mesh.materialRef), `${name} → unknown material ${mesh.materialRef}`).toBe(true);
    }
  });

  it('hood is a capped hemisphere with a back cap forward of the camera + clearance', () => {
    const hood = cockpitBlueprint.meshes.hood;
    expect(hood).toBeDefined();
    expect(hood?.type).toBe('cappedHemisphere');
    // Hood back cap must be at least 0.3m forward of camera (POC rule #2).
    const camZ = cockpitBlueprint.cameraPosition[2];
    const backCapZ = hood?.backCapZ ?? Number.POSITIVE_INFINITY;
    expect(camZ - backCapZ, 'hood backCapZ must leave ≥0.3m forward clearance').toBeGreaterThanOrEqual(
      0.3,
    );
  });

  it('has 4 wheel spokes (not 2, per POC identity spec)', () => {
    const spokes = Object.keys(cockpitBlueprint.meshes).filter((n) => /wheelSpoke\d/.test(n));
    expect(spokes).toHaveLength(4);
  });

  it('has exactly 8 flower petals (midway-mayhem ornament signature)', () => {
    const petals = Object.keys(cockpitBlueprint.meshes).filter((n) => /flowerPetal\d/.test(n));
    expect(petals).toHaveLength(8);
  });
});
