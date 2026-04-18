/**
 * @module cockpit/CockpitDamageFX
 *
 * Damage fire point-light + three rising smoke particles.
 * Meshes are exposed via forwarded refs so Cockpit's useFrame can animate them.
 * Extracted from Cockpit.tsx to keep that file under 300 LOC.
 */
import type * as THREE from 'three';

interface CockpitDamageFXProps {
  fireLightRef: React.RefObject<THREE.PointLight | null>;
  smokeRef0: React.RefObject<THREE.Mesh | null>;
  smokeRef1: React.RefObject<THREE.Mesh | null>;
  smokeRef2: React.RefObject<THREE.Mesh | null>;
}

export function CockpitDamageFX({
  fireLightRef,
  smokeRef0,
  smokeRef1,
  smokeRef2,
}: CockpitDamageFXProps) {
  return (
    <>
      {/* Damage fire reflection — orange point light, flickers at level >= 2 */}
      <pointLight
        ref={fireLightRef}
        position={[0, 0.4, -1.8]}
        intensity={0}
        distance={4}
        color="#ff6600"
        visible={false}
      />

      {/* Smoke particles — 3 dark spheres rising from hood at damage level >= 2 */}
      <mesh ref={smokeRef0} position={[-0.25, -0.3, -1.6]} visible={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#1a1a1a" transparent opacity={0} />
      </mesh>
      <mesh ref={smokeRef1} position={[0, -0.3, -1.7]} visible={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#222222" transparent opacity={0} />
      </mesh>
      <mesh ref={smokeRef2} position={[0.25, -0.3, -1.6]} visible={false}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#1a1a1a" transparent opacity={0} />
      </mesh>
    </>
  );
}
