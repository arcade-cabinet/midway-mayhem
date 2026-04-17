import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import type * as THREE from 'three';
import { assetUrl } from '@/assets/manifest';
import { composeTrack, DEFAULT_TRACK, type PiecePlacement } from '@/track/trackComposer';

/**
 * Render the composed Kenney track. Each piece is a cloned <primitive> from
 * the GLTF scene graph, positioned and rotated per the composer's placement.
 *
 * All pieces are baked with the Midway Mayhem brand palette (track_orange
 * road, rail_yellow curbs, shoulder_purple shoulders) in scripts/bake-kit.py,
 * so there's zero runtime retex here.
 */
export function TrackSystem() {
  const composition = useMemo(() => composeTrack(DEFAULT_TRACK, 10), []);
  return (
    <group data-testid="track-system" name="track">
      {composition.placements.map((p) => (
        <TrackPiece key={p.index} placement={p} />
      ))}
    </group>
  );
}

function TrackPiece({ placement }: { placement: PiecePlacement }) {
  const gltf = useGLTF(assetUrl(`gltf:${placement.assetId}`)) as unknown as {
    scene: THREE.Object3D;
  };
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  return (
    <group position={placement.position} rotation={[0, placement.rotationY, 0]} scale={10}>
      <primitive object={cloned} />
    </group>
  );
}

// Preload all the road pieces we actually use so drei's Suspense caches them
const PIECES_TO_PRELOAD = [
  'gltf:roadStart',
  'gltf:roadStraight',
  'gltf:roadStraightLong',
  'gltf:roadStraightArrow',
  'gltf:roadEnd',
  'gltf:roadCornerLarge',
  'gltf:roadCornerLarger',
  'gltf:roadCornerSmall',
  'gltf:roadRamp',
  'gltf:roadRampLong',
  'gltf:roadRampLongCurved',
  'gltf:roadCurved',
];
for (const id of PIECES_TO_PRELOAD) {
  useGLTF.preload(assetUrl(id));
}
