import { TRACK } from '../utils/constants';

export interface TrackSample {
  d: number;
  x: number;
  y: number;
  z: number;
  tangent: { x: number; z: number };
  normal: { x: number; z: number };
  bank: number;
}

export function sampleTrack(d: number): TrackSample {
  const x = Math.sin(d * 0.009) * 18 + Math.sin(d * 0.004) * 12;
  const y = Math.sin(d * 0.01) * 4;
  const z = -d;

  // Numerical derivative along distance → tangent on XZ plane
  const eps = 0.1;
  const xN = Math.sin((d + eps) * 0.009) * 18 + Math.sin((d + eps) * 0.004) * 12;
  const zN = -(d + eps);
  const dx = xN - x;
  const dz = zN - z;
  const len = Math.hypot(dx, dz) || 1;
  const tx = dx / len;
  const tz = dz / len;
  // Right-hand normal
  const nx = -tz;
  const nz = tx;
  // Bank proportional to curvature (2nd derivative component of x)
  const bank = Math.cos(d * 0.009) * 0.009 * 18 + Math.cos(d * 0.004) * 0.004 * 12;

  return { d, x, y, z, tangent: { x: tx, z: tz }, normal: { x: nx, z: nz }, bank };
}

/** Sample N points ahead of the player for the Yuka governor path-following. */
export function sampleLookahead(fromD: number, count = 40, step = 6): TrackSample[] {
  const out: TrackSample[] = [];
  for (let i = 0; i < count; i++) out.push(sampleTrack(fromD + i * step));
  return out;
}

/** World-space position of a lane centerline at distance d. */
export function laneCenterAt(d: number, laneIndex: number): { x: number; y: number; z: number } {
  const s = sampleTrack(d);
  const halfWidth = (TRACK.LANE_COUNT - 1) * TRACK.LANE_WIDTH * 0.5;
  const laneOffset = laneIndex * TRACK.LANE_WIDTH - halfWidth;
  return {
    x: s.x + s.normal.x * laneOffset,
    y: s.y,
    z: s.z + s.normal.z * laneOffset,
  };
}
