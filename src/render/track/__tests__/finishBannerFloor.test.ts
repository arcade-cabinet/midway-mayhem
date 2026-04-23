/**
 * A-DESC-3 gate: FinishBanner's floor checker must clamp to the dome
 * floor (y ≈ 0), not track the descended track Y. Pure source-level
 * invariant test — validates the constants without needing a GPU.
 *
 * Why:
 *   - The PRQ canonical vision is "run ends at the BOTTOM of the dome,
 *     on the big-top floor". If the floor follows the track's descended
 *     Y, the finish line visually lives mid-air, not on the floor.
 *   - If someone refactors FinishBanner.tsx and inadvertently anchors
 *     the floor to `bannerPose.y` or `goalPose.y`, this invariant must
 *     catch the regression.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FinishBanner } from '../FinishBanner';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(join(__dirname, '..', 'FinishBanner.tsx'), 'utf-8');

describe('FinishBanner — dome-floor invariants (A-DESC-3)', () => {
  it('module exports the FinishBanner component', () => {
    expect(typeof FinishBanner).toBe('function');
  });

  it('DOME_FLOOR_Y is pinned near world origin (≤ 0.25m)', () => {
    const match = SOURCE.match(/DOME_FLOOR_Y\s*=\s*(-?\d+(?:\.\d+)?)/);
    if (!match) throw new Error('DOME_FLOOR_Y constant not found');
    const y = Number(match[1]);
    expect(
      Math.abs(y),
      `DOME_FLOOR_Y=${y} — must be ≤ 0.25m from origin to read as dome floor, not a raised mat`,
    ).toBeLessThanOrEqual(0.25);
  });

  it('FINISH_FLOOR_SIZE_M spans at least 40m (wider than the track, reads as a floor)', () => {
    const match = SOURCE.match(/FINISH_FLOOR_SIZE_M\s*=\s*(\d+(?:\.\d+)?)/);
    if (!match) throw new Error('FINISH_FLOOR_SIZE_M constant not found');
    const size = Number(match[1]);
    expect(size, `FINISH_FLOOR_SIZE_M=${size} too small for dome floor read`).toBeGreaterThanOrEqual(40);
  });

  it('makeFinishFloorTexture is B&W-only (no brand colors — it is THE finish line)', () => {
    const floorFn = SOURCE.match(/makeFinishFloorTexture[\s\S]+?^}/m);
    if (!floorFn) throw new Error('makeFinishFloorTexture helper not found');
    const colors = floorFn[0].match(/#[0-9a-fA-F]{3,6}/g) ?? [];
    const bad = colors.filter((c) => c.toLowerCase() !== '#ffffff' && c.toLowerCase() !== '#0a0a0a');
    expect(bad, `non-B&W colors in floor checker: ${bad.join(', ')}`).toEqual([]);
  });

  it('the floor group renders with position y = floorY (dome floor), not bannerPose.y', () => {
    // Static check: the <group data-testid="finish-floor"> block uses
    // floorY, not bannerPose.y, in its position array.
    const floorGroup = SOURCE.match(
      /<group\s+position=\{\[bannerPose\.x,\s*([a-zA-Z_.]+),\s*bannerPose\.z\]\}[\s\S]+?data-testid="finish-floor"/,
    );
    if (!floorGroup) throw new Error('finish-floor group position not found');
    expect(
      floorGroup[1],
      `finish-floor y anchor is '${floorGroup[1]}' — must be 'floorY', NOT 'bannerPose.y' (which tracks the descended track Y)`,
    ).toBe('floorY');
  });
});
