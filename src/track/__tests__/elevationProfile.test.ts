/**
 * Elevation profile gate (PRQ A-DESC-1).
 *
 * The Midway is a coiled descent through the big-top — see
 * docs/ARCHITECTURE.md "Run elevation profile" for the target shape.
 *
 * The pre-existing track generator already descends, but it descends
 * EVERYWHERE (cumulative -765m by piece 79 because pitch hits the
 * clamp early and stays pinned). The PRQ vision is a SHAPED descent:
 * zone 1 mostly flat (intro), zones 2-4 progressively steeper.
 *
 * These tests assert the shape:
 *   1. Zone 1 (pieces 0-19, 25% of run) keeps cumulative descent ≤ 8m
 *      — players need to learn to steer before the dive begins.
 *   2. Total descent across the run is in [25, 70]m — too little doesn't
 *      read as a descent; too much is a free-fall artifact, not a coil.
 *   3. Across the descent phase (pieces 20-79), cumulative Y is
 *      monotonically non-increasing within a small per-piece tolerance.
 */
import { describe, expect, it } from 'vitest';
import { trackArchetypes } from '@/config';
import { generateTrack } from '@/ecs/systems/track';

const CANONICAL_SEED = 42;
const RUN_LENGTH = trackArchetypes.runLength;
const ZONE_1_END_INDEX = Math.floor(RUN_LENGTH * 0.25);
const DESCENT_PHASE_START_INDEX = ZONE_1_END_INDEX;

const ZONE_1_MAX_DESCENT_M = 8;
const TOTAL_MIN_DESCENT_M = 25;
const TOTAL_MAX_DESCENT_M = 70;
const PER_PIECE_RISE_TOLERANCE_M = 1.5;

describe('Elevation profile (PRQ A-DESC-1)', () => {
  it('generates the canonical track with the configured runLength', () => {
    const segs = generateTrack(CANONICAL_SEED);
    expect(segs.length).toBe(RUN_LENGTH);
  });

  it('zone 1 (intro) keeps cumulative descent gentle so the player can learn to steer', () => {
    const segs = generateTrack(CANONICAL_SEED);
    const startY = segs[0]!.startPose.y;
    const endZone1Y = segs[ZONE_1_END_INDEX - 1]!.endPose.y;
    const zone1Descent = startY - endZone1Y;
    expect(
      zone1Descent,
      `zone 1 (pieces 0-${ZONE_1_END_INDEX - 1}) descended ${zone1Descent.toFixed(2)}m, expected ≤ ${ZONE_1_MAX_DESCENT_M}m`,
    ).toBeLessThanOrEqual(ZONE_1_MAX_DESCENT_M);
  });

  it('total descent across the run lands in the readable-coil window [25, 70]m', () => {
    const segs = generateTrack(CANONICAL_SEED);
    const startY = segs[0]!.startPose.y;
    const endY = segs[segs.length - 1]!.endPose.y;
    const descent = startY - endY;
    expect(
      descent,
      `total descent ${descent.toFixed(2)}m outside [${TOTAL_MIN_DESCENT_M}, ${TOTAL_MAX_DESCENT_M}]. Less reads as flat; more is a free-fall artifact, not a coil.`,
    ).toBeGreaterThanOrEqual(TOTAL_MIN_DESCENT_M);
    expect(
      descent,
      `total descent ${descent.toFixed(2)}m exceeds the coil-readable upper bound of ${TOTAL_MAX_DESCENT_M}m.`,
    ).toBeLessThanOrEqual(TOTAL_MAX_DESCENT_M);
  });

  it('cumulative Y is monotonically non-increasing across the descent phase', () => {
    const segs = generateTrack(CANONICAL_SEED);
    let prevY = segs[DESCENT_PHASE_START_INDEX]!.startPose.y;
    const violations: Array<{ index: number; delta: number }> = [];
    for (let i = DESCENT_PHASE_START_INDEX; i < segs.length; i++) {
      const y = segs[i]!.endPose.y;
      const delta = y - prevY;
      if (delta > PER_PIECE_RISE_TOLERANCE_M) {
        violations.push({ index: i, delta });
      }
      prevY = y;
    }
    expect(
      violations.length,
      `expected no piece in indices [${DESCENT_PHASE_START_INDEX}, ${segs.length - 1}] to rise more than ${PER_PIECE_RISE_TOLERANCE_M}m. Violations: ${violations.map((v) => `i=${v.index} +${v.delta.toFixed(2)}m`).join(', ')}`,
    ).toBe(0);
  });
});
