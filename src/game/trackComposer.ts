/**
 * Track composer — turns a declarative piece list into world-space placements.
 *
 * Kenney Racing Kit pieces have a shared local anchor at (X=0.15, Y=0.65) where
 * the "front seam" of the road meets the cursor. Each piece advances the cursor
 * along the current heading by its length; corners also apply a lateral offset
 * perpendicular to the new heading and rotate the heading.
 *
 * Piece sizes (verified via Blender in scripts/bake-kit.py):
 *   straight       1 unit long, 1 wide, flat
 *   straightLong   2 units long, 1 wide, flat
 *   straightArrow  2 units long (arrow overlay)
 *   end            1.5 units long (cap)
 *   cornerSmall    1×1 tight turn
 *   cornerLarge    2×2, 90° turn (lateral 2)
 *   cornerLarger   3×3, 90° turn (lateral 3)
 *   ramp           1 long, rises 0.27
 *   rampLong       2 long, rises 0.52
 *   rampLongCurved 2 long, rises 0.52, 90° turn
 *   curved         2 long S-curve (no heading change, 1.5 wide)
 *
 * Unit scale: 1 kit unit = WORLD_SCALE meters in three.js. Default 10 (a racing-car-world-sized Hot Wheels track).
 */

export type PieceKind =
  | 'start'
  | 'straight'
  | 'straightLong'
  | 'straightArrow'
  | 'end'
  | 'cornerSmall'
  | 'cornerLarge'
  | 'cornerLarger'
  | 'ramp'
  | 'rampLong'
  | 'rampLongCurved'
  | 'curved';

export interface PieceSpec {
  length: number;
  lateral: number;
  headingChangeDeg: number;
  zRise: number;
  /** Asset manifest id (without the 'gltf:' prefix) */
  assetId: string;
}

export const PIECE_SPECS: Record<PieceKind, PieceSpec> = {
  start:          { length: 2.0, lateral: 0, headingChangeDeg: 0,  zRise: 0.0,  assetId: 'roadStart' },
  straight:       { length: 1.0, lateral: 0, headingChangeDeg: 0,  zRise: 0.0,  assetId: 'roadStraight' },
  straightLong:   { length: 2.0, lateral: 0, headingChangeDeg: 0,  zRise: 0.0,  assetId: 'roadStraightLong' },
  straightArrow:  { length: 2.0, lateral: 0, headingChangeDeg: 0,  zRise: 0.0,  assetId: 'roadStraightArrow' },
  end:            { length: 1.5, lateral: 0, headingChangeDeg: 0,  zRise: 0.0,  assetId: 'roadEnd' },
  cornerSmall:    { length: 1.0, lateral: 1, headingChangeDeg: 90, zRise: 0.0,  assetId: 'roadCornerSmall' },
  cornerLarge:    { length: 2.0, lateral: 2, headingChangeDeg: 90, zRise: 0.0,  assetId: 'roadCornerLarge' },
  cornerLarger:   { length: 3.0, lateral: 3, headingChangeDeg: 90, zRise: 0.0,  assetId: 'roadCornerLarger' },
  ramp:           { length: 1.0, lateral: 0, headingChangeDeg: 0,  zRise: 0.27, assetId: 'roadRamp' },
  rampLong:       { length: 2.0, lateral: 0, headingChangeDeg: 0,  zRise: 0.52, assetId: 'roadRampLong' },
  rampLongCurved: { length: 2.0, lateral: 2, headingChangeDeg: 90, zRise: 0.52, assetId: 'roadRampLongCurved' },
  curved:         { length: 2.0, lateral: 0, headingChangeDeg: 0,  zRise: 0.0,  assetId: 'roadCurved' },
};

export interface PiecePlacement {
  index: number;
  kind: PieceKind;
  assetId: string;
  /** World position of the piece's local origin (not the front seam) */
  position: [number, number, number];
  /** Heading in radians around three.js Y-axis (world +Z is back, so heading 0 = forward into -Z) */
  rotationY: number;
  /** Cumulative track distance along centerline up to this piece's START seam */
  distanceAtStart: number;
  length: number;
}

export interface ComposedTrack {
  placements: PiecePlacement[];
  totalLength: number;
  /** Final cursor state after all pieces laid — useful for loops or endings */
  endPosition: [number, number, number];
  endHeadingRad: number;
}

/** Three.js uses Y-up; Kenney uses Z-up (raises along +Z).
 * We snap pieces into the XZ plane (road plane) with elevation as Y.
 *
 * Kenney-local: +Y = track forward, +X = right, +Z = up.
 * Three-world:  +X = right, +Y = up, -Z = forward (so track forward = -Z).
 */
const LOCAL_ANCHOR = { x: 0.15, y: 0.65 }; // Kenney-local XY of the front-seam midpoint

export function composeTrack(
  kinds: readonly PieceKind[],
  worldScale = 10,
): ComposedTrack {
  const placements: PiecePlacement[] = [];
  // Cursor tracks the END of the last piece (= START of the next piece), in WORLD coords
  let cursorX = 0;
  let cursorY = 0; // elevation
  let cursorZ = 0;
  let headingRad = Math.PI; // facing -Z by default (Three.js "forward" for racing)

  let distanceCum = 0;

  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i];
    if (!kind) continue;
    const spec = PIECE_SPECS[kind];

    // Direction vector of the CURRENT heading, unit length, on the XZ plane:
    // headingRad 0 = +Z, π = -Z (our default forward), π/2 = +X, etc.
    const dirX = Math.sin(headingRad);
    const dirZ = Math.cos(headingRad);

    // The Kenney piece's local anchor (0.15, 0.65) maps to world coords via
    // rotation around world-Y by (heading + π) so that local +Y aligns with
    // the negative cursor direction; easier to just compute the local-frame
    // origin of the piece such that rotating and translating places the anchor
    // exactly at the cursor.
    //   We want: pieceOrigin + rot(heading) * (anchor_local_x, 0, anchor_local_y_scaled) = cursor
    // In three.js, the piece rotated by headingRad around Y, with local +Y becoming the local "up"
    // at the road surface and local +Y_kenney → world forward. To keep it simple we multiply world
    // scale by 1 (the composer works in Kenney units and the Scene component scales).

    // Anchor-to-world with rotation:
    const anchorLocalForward = LOCAL_ANCHOR.y * worldScale;
    const anchorLocalRight = LOCAL_ANCHOR.x * worldScale;
    const rotatedAnchorX = dirX * anchorLocalForward + dirZ * anchorLocalRight;
    const rotatedAnchorZ = dirZ * anchorLocalForward - dirX * anchorLocalRight;

    const placementX = cursorX - rotatedAnchorX;
    const placementZ = cursorZ - rotatedAnchorZ;
    const placementY = cursorY;

    // In three.js we set rotation.y to align Kenney +Y with world heading.
    // Kenney +Y local aligns to world heading by rotating negative headingRad
    // (three.js rotation.y is counter-clockwise looking down from +Y).
    const threeRotationY = -headingRad;

    placements.push({
      index: i,
      kind,
      assetId: spec.assetId,
      position: [placementX, placementY, placementZ],
      rotationY: threeRotationY,
      distanceAtStart: distanceCum,
      length: spec.length * worldScale,
    });

    // Advance cursor by piece length along current heading
    const lengthWorld = spec.length * worldScale;
    cursorX += dirX * lengthWorld;
    cursorZ += dirZ * lengthWorld;
    cursorY += spec.zRise * worldScale;
    distanceCum += lengthWorld;

    // Apply heading change
    headingRad = (headingRad + (spec.headingChangeDeg * Math.PI) / 180) % (Math.PI * 2);

    // Apply lateral offset in NEW heading
    if (spec.lateral !== 0) {
      const dirX2 = Math.sin(headingRad);
      const dirZ2 = Math.cos(headingRad);
      const latWorld = spec.lateral * worldScale;
      cursorX += dirX2 * latWorld;
      cursorZ += dirZ2 * latWorld;
      distanceCum += latWorld;
    }
  }

  return {
    placements,
    totalLength: distanceCum,
    endPosition: [cursorX, cursorY, cursorZ],
    endHeadingRad: headingRad,
  };
}

/**
 * First-pass default track — mostly straight with two gentle ramps so the
 * player can see the road directly ahead of the cockpit. Corners require
 * a follow-camera (scheduled work) before they'll feel right; for now the
 * straight run nails the "I'm racing down a track" feel.
 *
 * Total distance: ~320m of driving time.
 */
export const DEFAULT_TRACK: readonly PieceKind[] = [
  'start',
  'straightLong',
  'straightLong',
  'straightArrow',
  'straightLong',
  'rampLong',
  'straightLong',
  'straightLong',
  'straightLong',
  'straightArrow',
  'rampLong',
  'straightLong',
  'straightLong',
  'straightLong',
  'straightLong',
  'end',
];
