/**
 * TrackSystem — renders the composed Kenney track from GLB pieces.
 *
 * Each piece is a cloned <primitive> from the GLTF scene graph, positioned
 * and rotated per the composer's placement.
 *
 * All pieces are baked with the Midway Mayhem brand palette (track_orange
 * road, rail_yellow curbs, shoulder_purple shoulders) in scripts/bake-kit.py,
 * so there's zero runtime retex here.
 *
 * NOTE: Depends on @/assets/manifest (assetUrl) — port the asset manifest
 * from reference/src/assets/manifest.ts before enabling this component in
 * production. The ported manifest path will be src/assets/manifest.ts.
 * Until then, the procedural Track.tsx is used instead.
 */
import { useGLTF } from '@react-three/drei';
import { useMemo } from 'react';
import type * as THREE from 'three';
import { composeTrack, DEFAULT_TRACK, type PiecePlacement } from '@/track/trackComposer';

// Inline asset-url helper until src/assets/manifest.ts is committed.
// Replace with `import { assetUrl } from '@/assets/manifest'` once ported.
function assetUrl(id: string): string {
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '');
  // Map gltf:<name> → public/models/<name>.glb
  const match = id.match(/^gltf:(.+)$/);
  if (match) return `${base}/models/${match[1]}.glb`;
  throw new Error(`[assets] Unknown asset id: ${id}`);
}

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
