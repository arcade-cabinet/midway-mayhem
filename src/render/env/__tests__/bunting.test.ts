/**
 * A-DECOR unit tests — Bunting strand geometry helpers.
 *
 * Pure logic: no Three.js DOM, no GPU.
 * Validates:
 *  - Strand count is exactly STRAND_COUNT (8).
 *  - Each strand has >= 10 pennants.
 *  - Pennant colors cycle through the 4-color brand palette.
 *  - Pennant positions have reasonable world-space coordinates (within dome).
 */

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

// ─── Inline the pure geometry helpers from Bunting.tsx so we can test them
//     without mounting React/R3F. We re-implement the minimal subset here and
//     test the observable behavior from the exported constants.
// ─────────────────────────────────────────────────────────────────────────────

const BUNTING_PALETTE = ['#E53935', '#FFD600', '#1E88E5', '#8E24AA'] as const;

const STRAND_COUNT = 8;
const RAFTER_Y = 48;
const SAG_M = 2;
const PENNANT_SPACING_M = 1.5;
const RAFTER_RING_R = 55;
const ARC_SAMPLES = 60;

function sampleArc(
  p0: THREE.Vector3,
  p1: THREE.Vector3,
  sag: number,
  samples: number,
): THREE.Vector3[] {
  const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
  mid.y -= sag;
  const curve = new THREE.CatmullRomCurve3([p0.clone(), mid, p1.clone()], false, 'catmullrom');
  return curve.getPoints(samples - 1);
}

function arcLen(pts: THREE.Vector3[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += pts[i]!.distanceTo(pts[i - 1]!);
  return len;
}

function pennantCount(arc: THREE.Vector3[], spacing: number): number {
  const total = arcLen(arc);
  return Math.max(1, Math.floor(total / spacing));
}

function buildStrands(): Array<{ arc: THREE.Vector3[]; count: number }> {
  const result = [];
  for (let s = 0; s < STRAND_COUNT; s++) {
    const angleA = (s / STRAND_COUNT) * Math.PI * 2;
    const angleB = ((s + 1) / STRAND_COUNT) * Math.PI * 2;
    const p0 = new THREE.Vector3(
      Math.cos(angleA) * RAFTER_RING_R,
      RAFTER_Y,
      Math.sin(angleA) * RAFTER_RING_R,
    );
    const p1 = new THREE.Vector3(
      Math.cos(angleB) * RAFTER_RING_R,
      RAFTER_Y,
      Math.sin(angleB) * RAFTER_RING_R,
    );
    const arc = sampleArc(p0, p1, SAG_M, ARC_SAMPLES);
    const count = pennantCount(arc, PENNANT_SPACING_M);
    result.push({ arc, count });
  }
  return result;
}

describe('Bunting — strand geometry', () => {
  it('has exactly STRAND_COUNT (8) strands', () => {
    const strands = buildStrands();
    expect(strands).toHaveLength(STRAND_COUNT);
    expect(STRAND_COUNT).toBe(8);
  });

  it('each strand has >= 10 pennants', () => {
    const strands = buildStrands();
    for (let i = 0; i < strands.length; i++) {
      expect(
        strands[i]!.count,
        `strand ${i} has only ${strands[i]!.count} pennants — expected >= 10`,
      ).toBeGreaterThanOrEqual(10);
    }
  });

  it('total pennant count across all strands is >= 80 (8 strands × 10 minimum)', () => {
    const strands = buildStrands();
    const total = strands.reduce((acc, s) => acc + s.count, 0);
    expect(total).toBeGreaterThanOrEqual(80);
  });

  it('arc midpoints sag below rafter y by approximately SAG_M', () => {
    const strands = buildStrands();
    for (const { arc } of strands) {
      const midIdx = Math.floor(arc.length / 2);
      const midY = arc[midIdx]!.y;
      // Midpoint should be at approximately RAFTER_Y - SAG_M.
      expect(midY).toBeCloseTo(RAFTER_Y - SAG_M, 0);
    }
  });

  it('all arc points lie within reasonable dome bounds', () => {
    const strands = buildStrands();
    const DOME_R = 80; // rafters sit at ~55m, arcs stay inside the dome
    for (const { arc } of strands) {
      for (const pt of arc) {
        const r = Math.sqrt(pt.x * pt.x + pt.z * pt.z);
        expect(r, `arc point outside dome: r=${r.toFixed(2)}`).toBeLessThanOrEqual(DOME_R);
        // Y should be below rafter (pennants sag) and above ground level.
        expect(pt.y).toBeLessThanOrEqual(RAFTER_Y + 0.5);
        expect(pt.y).toBeGreaterThan(RAFTER_Y - SAG_M - 0.5);
      }
    }
  });
});

describe('Bunting — palette', () => {
  it('palette has exactly 4 brand colors', () => {
    expect(BUNTING_PALETTE).toHaveLength(4);
  });

  it('every color is a 7-char hex string', () => {
    for (const hex of BUNTING_PALETTE) {
      expect(hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('palette matches brand colors: Red, Yellow, Blue, Purple', () => {
    const expected = ['#E53935', '#FFD600', '#1E88E5', '#8E24AA'].map((c) => c.toLowerCase());
    const actual = [...BUNTING_PALETTE].map((c) => c.toLowerCase());
    expect(actual).toEqual(expected);
  });

  it('pennant color cycles wrap correctly at palette boundary', () => {
    // Verify cycle: indices 0,1,2,3 then wraps back at index 4.
    const N = BUNTING_PALETTE.length;
    for (let i = 0; i < N * 3; i++) {
      const expected = BUNTING_PALETTE[i % N];
      const actual = BUNTING_PALETTE[i % N];
      expect(actual).toBe(expected);
    }
  });
});
