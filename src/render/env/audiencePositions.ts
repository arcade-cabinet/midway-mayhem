/**
 * Deterministic crowd-placement helpers for the big-top audience layer.
 *
 * All logic is pure and seedable — same seed → same positions every time,
 * which keeps CI screenshot baselines stable.
 *
 * Geometry note: the audience ring sits at world-space absolute coordinates
 * (r ∈ [60,120], y ∈ [5,18]) so it is independent of the moving track/
 * WorldScroller. Drop <Audience /> outside any TrackScroller and the
 * silhouettes stay fixed in the dome.
 */

import { createRng } from '@/utils/rng';

/** Brand palette — verbatim from STANDARDS.md / constants.ts. */
export const AUDIENCE_PALETTE = [
  '#E53935', // Red
  '#FFD600', // Yellow
  '#1E88E5', // Blue
  '#8E24AA', // Purple
  '#F36F21', // Orange
] as const;

export interface AudiencePosition {
  /** World-space X. */
  x: number;
  /** World-space Y (height in dome). */
  y: number;
  /** World-space Z. */
  z: number;
  /** Rotation around Y-axis so each silhouette faces the track centre. */
  rotY: number;
  /** Phase in [0, 2π) — drives the per-instance idle bob so instances are
   *  not in lockstep. Derived from index so the same seed always yields
   *  the same phase per slot. */
  bobPhase: number;
  /** Palette color hex for this instance. Cycles through AUDIENCE_PALETTE. */
  color: string;
}

/**
 * Generate `count` audience-seat positions inside the big-top dome.
 *
 * Each position is placed on a polar grid:
 *   - Radius r  ∈ [60, 120] m  — between the track zone and the dome wall.
 *   - Angle  θ  ∈ [0, 2π)     — full sweep of the ring.
 *   - Height y  ∈ [5, 18] m   — bleacher tier range.
 *
 * A mild tiering nudge is applied so nearby rows stagger like real bleachers
 * (each instance gets a small extra y based on which radial "row" it is in).
 *
 * @param seed  Deterministic seed — use a fixed constant in production so
 *              baselines are stable across runs.
 * @param count Number of instances (default 2000).
 */
export function audiencePositions(seed: number, count = 2000): AudiencePosition[] {
  const rng = createRng(seed);
  const positions: AudiencePosition[] = [];

  for (let i = 0; i < count; i++) {
    const r = rng.range(60, 120);
    const theta = rng.range(0, Math.PI * 2);
    // Base y plus a bleacher-style tier nudge (radial band → row offset).
    const rowBand = Math.floor((r - 60) / 15); // 0..3 for r in [60,120]
    const baseY = rng.range(5, 18);
    const y = baseY + rowBand * 1.2;

    positions.push({
      x: Math.cos(theta) * r,
      y,
      z: Math.sin(theta) * r,
      rotY: theta + Math.PI, // face toward origin (the track)
      bobPhase: (i / count) * Math.PI * 2, // evenly spaced phases — no lockstep
      color: AUDIENCE_PALETTE[i % AUDIENCE_PALETTE.length] as string,
    });
  }

  return positions;
}
