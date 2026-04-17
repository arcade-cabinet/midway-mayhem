/**
 * @module cockpit/CockpitSteeringWheel
 *
 * Steering wheel group: torus rim, chrome spokes, column, and honkable horn cap.
 * Extracted from Cockpit.tsx to keep that file under 300 LOC.
 */
import type * as THREE from 'three';

interface CockpitSteeringWheelProps {
  wheelRef: React.RefObject<THREE.Group | null>;
  chromeMat: THREE.MeshPhysicalMaterial;
  rimColor: string;
}

export function CockpitSteeringWheel({ wheelRef, chromeMat, rimColor }: CockpitSteeringWheelProps) {
  return (
    <group ref={wheelRef} position={[0, 0.82, 0.2]} rotation={[-Math.PI / 4.3, 0, 0]}>
      {/* Column: runs from hub back into the dash cowl */}
      <mesh position={[0, 0, -0.35]} rotation={[Math.PI / 2, 0, 0]} material={chromeMat}>
        <cylinderGeometry args={[0.035, 0.035, 0.6, 10]} />
      </mesh>
      {/* Rim — color driven by loadout */}
      <mesh>
        <torusGeometry args={[0.4, 0.06, 18, 36]} />
        <meshPhysicalMaterial
          color={rimColor}
          roughness={0.2}
          metalness={0.3}
          clearcoat={0.8}
          clearcoatRoughness={0.1}
        />
      </mesh>
      {/* 4 chrome spokes in an X + horizontal + vertical */}
      <mesh material={chromeMat}>
        <cylinderGeometry args={[0.022, 0.022, 0.78, 10]} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} material={chromeMat}>
        <cylinderGeometry args={[0.022, 0.022, 0.78, 10]} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 4]} material={chromeMat}>
        <cylinderGeometry args={[0.018, 0.018, 0.78, 10]} />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]} material={chromeMat}>
        <cylinderGeometry args={[0.018, 0.018, 0.78, 10]} />
      </mesh>
      {/* Horn cap — red, honkable */}
      <mesh
        name="horn"
        position={[0, 0, 0.03]}
        rotation={[Math.PI / 2, 0, 0]}
        onPointerDown={(e) => {
          e.stopPropagation();
          // biome-ignore lint/suspicious/noExplicitAny: dev hook
          (window as any).__mmHonk?.();
        }}
      >
        <cylinderGeometry args={[0.15, 0.18, 0.08, 28]} />
        <meshStandardMaterial color="#ff3e3e" emissive="#330808" />
      </mesh>
      <mesh position={[0, 0, 0.025]} material={chromeMat}>
        <torusGeometry args={[0.18, 0.025, 10, 24]} />
      </mesh>
    </group>
  );
}
