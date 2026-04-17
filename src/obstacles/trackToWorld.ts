/**
 * @module obstacles/trackToWorld
 *
 * Converts a (distance, lateral) position in track-space to world-space
 * (x, y, z, heading). Used by ObstacleSystem, PickupSystem, BalloonLayer,
 * FireHoopGate, and MirrorLayer.
 *
 * Extracted from ObstacleSystem.tsx so that module stays under 300 LOC.
 */

import { composeTrack, type PiecePlacement } from '@/track/trackComposer';

export function trackToWorld(
  composition: ReturnType<typeof composeTrack>,
  d: number,
  lateral: number,
): { x: number; y: number; z: number; heading: number } {
  let placement: PiecePlacement | undefined;
  for (const p of composition.placements) {
    if (d >= p.distanceAtStart && d < p.distanceAtStart + p.length) {
      placement = p;
      break;
    }
  }
  if (!placement) {
    placement = composition.placements[composition.placements.length - 1];
    if (!placement) return { x: 0, y: 0, z: 0, heading: 0 };
  }

  const offsetIntoPiece = d - placement.distanceAtStart;
  const h = placement.rotationY;
  const forwardX = -Math.sin(h);
  const forwardZ = -Math.cos(h);
  const latX = Math.cos(h);
  const latZ = -Math.sin(h);

  const anchorFwd = 0.65 * 10;
  const anchorRight = 0.15 * 10;
  const seamWorldX = placement.position[0] + forwardX * anchorFwd + latX * anchorRight;
  const seamWorldZ = placement.position[2] + forwardZ * anchorFwd + latZ * anchorRight;

  return {
    x: seamWorldX + forwardX * offsetIntoPiece + latX * lateral,
    y: placement.position[1],
    z: seamWorldZ + forwardZ * offsetIntoPiece + latZ * lateral,
    heading: h,
  };
}
