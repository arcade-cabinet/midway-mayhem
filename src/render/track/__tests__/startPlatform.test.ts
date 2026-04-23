/**
 * StartPlatform structural invariants — pure constant-layer assertions.
 *
 * The vision (docs/DESIGN.md §"Start platform — suspended from the dome cap"):
 *   - Platform y ≥ +25m above track piece 0
 *   - ≥ 4 visible wire struts extending upward from the platform corners
 *   - Each strut's top end reaches > +45m world-space y (dome cap zone)
 *
 * These invariants are provable from the exported constants alone — no GPU,
 * no rendering, no browser. If someone lowers PLATFORM_Y below 25 or reduces
 * the strut count below 4, this test fails with a concrete message.
 *
 * A companion browser test (StartPlatform.browser.test.tsx) captures a
 * screenshot to give human reviewers a visual baseline of the wire geometry.
 */
import { describe, expect, it } from 'vitest';
import { DOME_CAP_Y, PLATFORM_Y, WIRE_STRUT_COUNT } from '../StartPlatform';

/** Track piece 0 starts at y=0.5m — the integrator's ground clearance. */
const TRACK_PIECE_0_Y = 0.5;

describe('StartPlatform — structural invariants', () => {
  it('platform y is at least 25m above track piece 0', () => {
    const heightAboveTrack = PLATFORM_Y - TRACK_PIECE_0_Y;
    expect(
      heightAboveTrack,
      `PLATFORM_Y=${PLATFORM_Y} gives only ${heightAboveTrack.toFixed(1)}m above track (need ≥25m). ` +
        'Raise PLATFORM_Y in StartPlatform.tsx.',
    ).toBeGreaterThanOrEqual(25);
  });

  it('wire strut count is at least 4', () => {
    expect(
      WIRE_STRUT_COUNT,
      `Need ≥4 wire struts for symmetric corner coverage; got ${WIRE_STRUT_COUNT}. ` +
        'Update WIRE_STRUT_COUNT in StartPlatform.tsx.',
    ).toBeGreaterThanOrEqual(4);
  });

  it('each strut top end reaches above +45m world-space y', () => {
    // Struts run from deck level (deckY ≈ pose.y - 0.1 ≈ 0.4 in local space)
    // up to (DOME_CAP_Y - PLATFORM_Y) in local group space, which maps to
    // DOME_CAP_Y in world-space because the group sits at PLATFORM_Y.
    const strutTopWorldY = DOME_CAP_Y; // group.y + (DOME_CAP_Y - PLATFORM_Y) = DOME_CAP_Y
    expect(
      strutTopWorldY,
      `Each strut top is at world y=${strutTopWorldY}m but must exceed 45m. ` +
        'Raise DOME_CAP_Y or PLATFORM_Y in StartPlatform.tsx.',
    ).toBeGreaterThan(45);
  });

  it('dome cap is above platform (struts extend upward, not downward)', () => {
    expect(
      DOME_CAP_Y,
      `DOME_CAP_Y (${DOME_CAP_Y}) must be strictly above PLATFORM_Y (${PLATFORM_Y}) — struts must go UP.`,
    ).toBeGreaterThan(PLATFORM_Y);
  });
});
