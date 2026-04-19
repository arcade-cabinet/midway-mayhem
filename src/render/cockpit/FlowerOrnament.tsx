/**
 * FlowerOrnament — the 8-petal spinning hood ornament. One of the
 * identity-critical clown-car details per project memory. Center + petals
 * + stem are blueprint meshes; this component groups them and rotates
 * the whole group around its own Y axis.
 *
 * Blueprint positions each petal in world space around a common pivot
 * (near flowerCenter's position). To rotate the ornament as a unit, we
 * translate the children so they're relative to the pivot, then apply
 * the group rotation, then translate the group to the pivot. Pure group
 * math — no per-frame re-math of individual petal coords.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { cockpitBlueprint } from '@/config';
import { CockpitMeshNode } from './blueprintMesh';

/** Revolutions per second. Fast enough to feel alive, slow enough to read as a flower. */
const SPIN_RATE_REV_PER_SEC = 0.45;

const FLOWER_NAME_PATTERN = /^flower(Center|Petal\d+|Stem)$/;

export function isFlowerMesh(name: string): boolean {
  return FLOWER_NAME_PATTERN.test(name);
}

export function FlowerOrnament() {
  const spinRef = useRef<THREE.Group | null>(null);

  // Pivot = flowerCenter's world position. Petals orbit this point at
  // radius 0.13m in the blueprint; translating them by -pivot lets the
  // group rotation spin them correctly around the center.
  const center = cockpitBlueprint.meshes.flowerCenter;
  const pivot = center?.position ?? [0, 0.87, -2.85];

  useFrame((_state, dt) => {
    const g = spinRef.current;
    if (!g) return;
    g.rotation.y += SPIN_RATE_REV_PER_SEC * Math.PI * 2 * dt;
  });

  const children: Array<[string, typeof center]> = [];
  for (const [name, mesh] of Object.entries(cockpitBlueprint.meshes)) {
    if (!isFlowerMesh(name)) continue;
    children.push([name, mesh]);
  }
  // Deterministic order so draw-calls don't flicker.
  children.sort(([a], [b]) => a.localeCompare(b));

  return (
    <group name="flower-ornament" position={pivot} ref={spinRef}>
      {children.map(([name, mesh]) => {
        if (!mesh) return null;
        const material = cockpitBlueprint.materials[mesh.materialRef];
        if (!material) {
          throw new Error(`flower: mesh "${name}" missing material "${mesh.materialRef}"`);
        }
        // Shift children into pivot-local space by subtracting the pivot.
        const local = mesh.position
          ? ([
              mesh.position[0] - pivot[0],
              mesh.position[1] - pivot[1],
              mesh.position[2] - pivot[2],
            ] as [number, number, number])
          : mesh.position;
        const translated = { ...mesh, position: local };
        return <CockpitMeshNode key={name} name={name} mesh={translated} material={material} />;
      })}
    </group>
  );
}
