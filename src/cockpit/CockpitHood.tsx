/**
 * @module cockpit/CockpitHood
 *
 * Hood, chrome ridge, gold accent, and spinning-flower ornament.
 * Extracted from Cockpit.tsx to keep that file under 300 LOC.
 */
import { useMemo } from 'react';
import type * as THREE from 'three';

interface CockpitHoodProps {
  hoodMat: THREE.MeshStandardMaterial;
  chromeMat: THREE.MeshPhysicalMaterial;
  windshieldArchMat: THREE.MeshStandardMaterial;
  hoodZOffset: number;
  ornamentRef: React.RefObject<THREE.Group | null>;
}

export function CockpitHood({
  hoodMat,
  chromeMat,
  windshieldArchMat,
  hoodZOffset,
  ornamentRef,
}: CockpitHoodProps) {
  const petals = useMemo(
    () => Array.from({ length: 8 }, (_, i) => ({ key: i, rotZ: (Math.PI / 4) * i })),
    [],
  );

  return (
    <>
      {/* HOOD — elongated bubbled shape (VW-Beetle + clown-car combo).
          Lowered (y=-0.1) and scaled down so the driver's forward view
          opens up — hood reads as a rounded horizon rather than a wall.
          hoodZOffset pushes the hood forward on narrow form factors so
          more track is visible through the windshield. */}
      <mesh position={[0, -0.1, -1.9 + hoodZOffset]} material={hoodMat} scale={[0.95, 0.75, 1.25]}>
        <sphereGeometry args={[0.92, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* Chrome ridge — laid ON the hood surface */}
      <mesh position={[0, 0.55, -1.95]} material={chromeMat}>
        <boxGeometry args={[0.06, 0.02, 1.6]} />
      </mesh>
      {/* Gold hood accent line toward headlights */}
      <mesh position={[0, 0.15, -2.85]} material={windshieldArchMat}>
        <boxGeometry args={[1.1, 0.04, 0.08]} />
      </mesh>

      {/* Squirting flower hood ornament — sits on the front lip of the hood */}
      <group ref={ornamentRef} position={[0, 0.6, -2.7]}>
        <mesh material={chromeMat}>
          <cylinderGeometry args={[0.025, 0.025, 0.25, 8]} />
        </mesh>
        <mesh position={[0, 0.22, 0]}>
          <sphereGeometry args={[0.12, 16, 12]} />
          <meshStandardMaterial color="#ffff00" emissive="#332200" />
        </mesh>
        {petals.map((p) => (
          <mesh key={p.key} position={[0, 0.22, 0]} rotation={[0, 0, p.rotZ]}>
            <cylinderGeometry args={[0.045, 0.045, 0.35, 6]} />
            <meshStandardMaterial color="#ff00ff" />
          </mesh>
        ))}
      </group>
    </>
  );
}
