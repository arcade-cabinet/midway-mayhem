/**
 * Rear-view mirror surface. The blueprint has the frame + stem + glass
 * plane; this component replaces the generic meshStandardMaterial on the
 * glass with drei's MeshReflectorMaterial so the back of the cockpit +
 * seat + circus big-top actually reflect.
 *
 * Why split from blueprintMesh.tsx:
 *   - MeshReflectorMaterial needs a Canvas-managed RT; it's NOT a drop-in
 *     material swap in a generic renderer.
 *   - The reflective surface needs `mirror` + `distortion` tuned against
 *     the scene ambient — values live here rather than in the blueprint
 *     so the blueprint stays renderer-agnostic.
 *   - Only ONE surface in the cockpit is reflective, so special-casing
 *     is cheaper than adding a new material "kind" to the schema.
 */
import { MeshReflectorMaterial } from '@react-three/drei';
import { cockpitBlueprint } from '@/config';

export function isMirrorGlassMesh(name: string): boolean {
  return name === 'mirrorGlass';
}

export function RearViewMirror() {
  const glass = cockpitBlueprint.meshes.mirrorGlass;
  if (!glass || glass.type !== 'plane') return null;
  if (!glass.position) return null;
  const size = (glass.size ?? [0.38, 0.13]) as [number, number];

  return (
    <mesh name="mirrorGlass" position={glass.position} rotation={glass.rotation ?? [0, 0, 0]}>
      <planeGeometry args={size} />
      <MeshReflectorMaterial
        blur={[120, 30]}
        resolution={512}
        mixBlur={0.6}
        mixStrength={1.1}
        roughness={0.25}
        depthScale={0.1}
        minDepthThreshold={0.9}
        maxDepthThreshold={1.2}
        color="#ffffff"
        metalness={0.85}
      />
    </mesh>
  );
}
