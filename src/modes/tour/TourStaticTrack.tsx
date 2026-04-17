/**
 * @module modes/tour/TourStaticTrack
 *
 * Static walkable track for BigTopTour — all 12 Kenney Racing Kit pieces
 * composed via composeTrack and rendered as GLB primitives.
 * Extracted from BigTopTour.tsx to keep that file under 300 LOC.
 */
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { assetUrl } from '@/assets/manifest';
import { composeTrack, DEFAULT_TRACK, type PiecePlacement } from '@/track/trackComposer';

export function TourStaticTrack() {
  const composition = composeTrack(DEFAULT_TRACK, 10);
  return (
    <group name="tour-track">
      {composition.placements.map((p) => (
        <TourTrackPiece key={p.index} placement={p} />
      ))}
    </group>
  );
}

function TourTrackPiece({ placement }: { placement: PiecePlacement }) {
  const gltf = useGLTF(assetUrl(`gltf:${placement.assetId}`)) as unknown as {
    scene: THREE.Object3D;
  };
  const cloned = gltf.scene.clone(true);
  return (
    <group position={placement.position} rotation={[0, placement.rotationY, 0]} scale={10}>
      <primitive object={cloned} />
    </group>
  );
}

// Preload all track pieces used by the tour
const TOUR_PIECES = [
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
for (const id of TOUR_PIECES) {
  useGLTF.preload(assetUrl(id));
}
