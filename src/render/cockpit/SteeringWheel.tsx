/**
 * SteeringWheel — rotates the wheel rim + 4 spokes + hub around the
 * column axis based on live `steer` input. The hornCap stays static
 * (HonkableHorn owns it) so clicking the horn doesn't feel like the
 * whole wheel is spinning under you.
 *
 * The wheel is tilted back toward the driver in the blueprint
 * (rotation.x ≈ 0.628 rad = 36°). To rotate the wheel "around its own
 * column", we:
 *   1. translate child meshes into rim-local space (subtract wheelRim's
 *      world position)
 *   2. apply the blueprint's tilt rotation on the outer group
 *   3. apply the steer-driven rotation on an inner child group (around
 *      the tilted local Z axis, which is "out of the face of the wheel")
 *
 * Cockpit.tsx filters wheelRim / wheelHub / wheelSpoke* out of the
 * generic loop so this component is the sole renderer.
 */
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { cockpitBlueprint } from '@/config';
import { useGameStore } from '@/game/gameState';

const WHEEL_NAME_PATTERN = /^(wheelRim|wheelHub|wheelSpoke\d+)$/;

export function isWheelMesh(name: string): boolean {
  return WHEEL_NAME_PATTERN.test(name);
}

/** Max rotation around the column axis at ±1 steer, radians (~90°). */
const MAX_WHEEL_ROT_RAD = (90 * Math.PI) / 180;
/** Lerp factor. */
const WHEEL_LERP = 8;

export function SteeringWheel() {
  const spinRef = useRef<THREE.Group | null>(null);
  const smoothed = useRef(0);

  const rim = cockpitBlueprint.meshes.wheelRim;
  const rimPos = rim?.position ?? [0, 1.0, -0.1];
  const rimRot = rim?.rotation ?? [0.628, 0, 0];

  useFrame((_state, dt) => {
    const g = spinRef.current;
    if (!g) return;
    const steer = Math.max(-1, Math.min(1, useGameStore.getState().steer));
    const target = -steer * MAX_WHEEL_ROT_RAD;
    const k = 1 - Math.exp(-WHEEL_LERP * dt);
    smoothed.current += (target - smoothed.current) * k;
    // Local Z is "out of the wheel face" after the blueprint's X-tilt.
    g.rotation.z = smoothed.current;
  });

  const wheelChildren: Array<{ name: string; mesh: typeof rim | undefined }> = [];
  for (const name of Object.keys(cockpitBlueprint.meshes)) {
    if (!isWheelMesh(name)) continue;
    wheelChildren.push({ name, mesh: cockpitBlueprint.meshes[name] });
  }
  wheelChildren.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <group name="steering-wheel-pivot" position={rimPos} rotation={rimRot}>
      <group ref={spinRef} name="steering-wheel-spin">
        {wheelChildren.map(({ name, mesh }) => {
          if (!mesh) return null;
          const material = cockpitBlueprint.materials[mesh.materialRef];
          if (!material) {
            throw new Error(`wheel: mesh "${name}" missing material "${mesh.materialRef}"`);
          }
          // Child-local position: subtract the pivot (rimPos). Also
          // un-apply the outer rotation — cheap trick: author the spin
          // group to use inverse-blueprint-rotation children. Instead,
          // since rimRot's only significant component is an X-tilt, we
          // just transform positions to rim-local coords analytically.
          const [cx, cy, cz] = mesh.position ?? rimPos;
          const local: [number, number, number] = [cx - rimPos[0], cy - rimPos[1], cz - rimPos[2]];
          return renderPrimitive(name, mesh, local, material);
        })}
      </group>
    </group>
  );
}

/**
 * Small inline primitive renderer — the wheel meshes are all simple
 * sphere / cylinder / torus / box. We replicate the relevant cases from
 * blueprintMesh.tsx but omit rotation/scale at the child level because
 * the outer group owns those transforms. Child meshes keep their OWN
 * (blueprint) rotation so spokes remain oriented correctly.
 */
function renderPrimitive(
  name: string,
  mesh: NonNullable<(typeof cockpitBlueprint.meshes)[string]>,
  localPos: [number, number, number],
  material: NonNullable<(typeof cockpitBlueprint.materials)[string]>,
) {
  const rot = mesh.rotationEuler ?? mesh.rotation ?? [0, 0, 0];
  const materialNode = (
    <meshStandardMaterial
      color={material.baseColor}
      roughness={material.roughness}
      metalness={material.metalness}
    />
  );
  switch (mesh.type) {
    case 'cylinder': {
      const r = mesh.radius ?? 0.04;
      const len = mesh.length ?? 0.2;
      return (
        <mesh key={name} name={name} position={localPos} rotation={rot}>
          <cylinderGeometry args={[r, r, len, 20]} />
          {materialNode}
        </mesh>
      );
    }
    case 'torus': {
      const major = mesh.majorRadius ?? 0.26;
      const minor = mesh.minorRadius ?? 0.025;
      return (
        <mesh key={name} name={name} position={localPos} rotation={rot}>
          <torusGeometry args={[major, minor, 16, 28]} />
          {materialNode}
        </mesh>
      );
    }
    default:
      return null;
  }
}
