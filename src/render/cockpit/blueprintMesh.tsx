/**
 * Renders a single {@link CockpitMesh} from the cockpit blueprint as an R3F
 * primitive. Keeps geometry/material mapping in one place so the blueprint
 * is the sole source of truth for the cockpit's identity — add a mesh to
 * the JSON and it shows up, no JSX plumbing required.
 *
 * Blender → R3F frame: both are right-handed, Y-up by convention here. The
 * blueprint agent runs in this frame, so rotations pass through unchanged.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import type { CockpitMaterial, CockpitMesh } from '@/config';
import { makePolkaDotTexture } from './polkaDotTexture';

const DEFAULT_SEGMENTS = {
  sphereWidth: 28,
  sphereHeight: 20,
  cylinderRadial: 24,
  torusRadial: 28,
  torusTubular: 16,
};

function resolveRotation(mesh: CockpitMesh): [number, number, number] {
  // Blender-exporter sometimes writes `rotationEuler`, sometimes `rotation`.
  // Both are Euler XYZ triples in radians; pick whichever is present, default
  // to identity.
  return mesh.rotationEuler ?? mesh.rotation ?? [0, 0, 0];
}

function resolveScale(mesh: CockpitMesh): [number, number, number] {
  return mesh.scale ?? [1, 1, 1];
}

function resolvePosition(mesh: CockpitMesh): [number, number, number] {
  if (mesh.position) return mesh.position;
  // Strings/cables use fromPos + toPos instead of position + length.
  if (mesh.fromPos && mesh.toPos) {
    return [
      (mesh.fromPos[0] + mesh.toPos[0]) / 2,
      (mesh.fromPos[1] + mesh.toPos[1]) / 2,
      (mesh.fromPos[2] + mesh.toPos[2]) / 2,
    ];
  }
  return [0, 0, 0];
}

function CockpitStringRotation(mesh: CockpitMesh): [number, number, number] {
  // Compute the Euler rotation that orients a Y-axis-aligned cylinder (three's
  // default) along the fromPos → toPos direction.
  if (!mesh.fromPos || !mesh.toPos) return [0, 0, 0];
  const dir = new THREE.Vector3(
    mesh.toPos[0] - mesh.fromPos[0],
    mesh.toPos[1] - mesh.fromPos[1],
    mesh.toPos[2] - mesh.fromPos[2],
  );
  if (dir.lengthSq() === 0) return [0, 0, 0];
  dir.normalize();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const quat = new THREE.Quaternion().setFromUnitVectors(yAxis, dir);
  const e = new THREE.Euler().setFromQuaternion(quat);
  return [e.x, e.y, e.z];
}

function stringLength(mesh: CockpitMesh): number {
  if (!mesh.fromPos || !mesh.toPos) return 0;
  const dx = mesh.toPos[0] - mesh.fromPos[0];
  const dy = mesh.toPos[1] - mesh.fromPos[1];
  const dz = mesh.toPos[2] - mesh.fromPos[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Resolves a {@link CockpitMaterial} to R3F material JSX. Polka-dot materials
 * bake a CanvasTexture once per material instance via useMemo so the
 * blueprint can fan out hundreds of meshes without thrashing the GPU.
 */
function CockpitMaterialNode({ material }: { material: CockpitMaterial }) {
  const tex = useMemo(() => {
    if (!material.dotColor) return null;
    return makePolkaDotTexture(material.dotColor, material.baseColor, {
      dotsPerSide: material.dotsPerSide ?? 3,
    });
  }, [material.baseColor, material.dotColor, material.dotsPerSide]);

  if (tex) {
    return (
      <meshStandardMaterial
        map={tex}
        roughness={material.roughness}
        metalness={material.metalness}
      />
    );
  }
  return (
    <meshStandardMaterial
      color={material.baseColor}
      roughness={material.roughness}
      metalness={material.metalness}
    />
  );
}

export interface CockpitMeshNodeProps {
  name: string;
  mesh: CockpitMesh;
  material: CockpitMaterial;
}

/**
 * One blueprint mesh → one R3F &lt;mesh&gt;. Type-specific geometry +
 * shared material resolver.
 */
export function CockpitMeshNode({ name, mesh, material }: CockpitMeshNodeProps) {
  const position = resolvePosition(mesh);
  const rotation = resolveRotation(mesh);
  const scale = resolveScale(mesh);
  const materialNode = <CockpitMaterialNode material={material} />;

  switch (mesh.type) {
    case 'sphere': {
      const r = mesh.radius ?? 0.1;
      return (
        <mesh name={name} position={position} rotation={rotation} scale={scale}>
          <sphereGeometry args={[r, DEFAULT_SEGMENTS.sphereWidth, DEFAULT_SEGMENTS.sphereHeight]} />
          {materialNode}
        </mesh>
      );
    }
    case 'box': {
      const s = (mesh.size ?? [1, 1, 1]) as [number, number, number];
      return (
        <mesh name={name} position={position} rotation={rotation} scale={scale}>
          <boxGeometry args={s} />
          {materialNode}
        </mesh>
      );
    }
    case 'cylinder': {
      // Cable cylinders (strings) use fromPos/toPos + radius; everything else
      // uses position + rotation + length.
      const r = mesh.radius ?? 0.05;
      const len = mesh.length ?? stringLength(mesh);
      const pos = position;
      const rot = mesh.fromPos && mesh.toPos ? CockpitStringRotation(mesh) : rotation;
      return (
        <mesh name={name} position={pos} rotation={rot} scale={scale}>
          <cylinderGeometry args={[r, r, len, DEFAULT_SEGMENTS.cylinderRadial]} />
          {materialNode}
        </mesh>
      );
    }
    case 'cylinderSweep': {
      const r = mesh.radius ?? 0.5;
      const len = mesh.widthAlongX ?? mesh.length ?? 1.5;
      const arcRad = ((mesh.arcDeg ?? 360) * Math.PI) / 180;
      return (
        <mesh name={name} position={position} rotation={rotation} scale={scale}>
          <cylinderGeometry
            args={[r, r, len, DEFAULT_SEGMENTS.cylinderRadial, 1, true, 0, arcRad]}
          />
          {materialNode}
        </mesh>
      );
    }
    case 'torus': {
      const major = mesh.majorRadius ?? 0.3;
      const minor = mesh.minorRadius ?? 0.03;
      return (
        <mesh name={name} position={position} rotation={rotation} scale={scale}>
          <torusGeometry
            args={[major, minor, DEFAULT_SEGMENTS.torusTubular, DEFAULT_SEGMENTS.torusRadial]}
          />
          {materialNode}
        </mesh>
      );
    }
    case 'halfTorus': {
      const major = mesh.majorRadius ?? 0.9;
      const minor = mesh.minorRadius ?? 0.05;
      return (
        <mesh name={name} position={position} rotation={rotation} scale={scale}>
          <torusGeometry
            args={[
              major,
              minor,
              DEFAULT_SEGMENTS.torusTubular,
              DEFAULT_SEGMENTS.torusRadial,
              Math.PI,
            ]}
          />
          {materialNode}
        </mesh>
      );
    }
    case 'plane': {
      const s = (mesh.size ?? [0.4, 0.2]) as [number, number];
      return (
        <mesh name={name} position={position} rotation={rotation} scale={scale}>
          <planeGeometry args={s} />
          {materialNode}
        </mesh>
      );
    }
    case 'cappedHemisphere': {
      // Dome-facing-forward car nose. The blueprint agent authors this in
      // the Blender/three.js native frame: sphere (thetaLength=π/2) gives
      // an upper hemisphere, and the blueprint's rotation X=+π/2 turns
      // local +Y → world -Z so the dome extends forward. Scale fields
      // (widthScale, depthScale, heightScale) are applied as non-uniform
      // scale on the SAME group that holds the rotation — the agent uses
      // the pre-rotation axis convention:
      //   widthScale  → local X, stays world X (car width)
      //   depthScale  → local Y, becomes world -Z (hood length forward)
      //   heightScale → local Z, becomes world Y (hood thickness)
      const r = mesh.radius ?? 1;
      const combinedScale: [number, number, number] = [
        scale[0] * (mesh.widthScale ?? 1),
        scale[1] * (mesh.depthScale ?? 1),
        scale[2] * (mesh.heightScale ?? 1),
      ];
      return (
        <group name={name} position={position} rotation={rotation} scale={combinedScale}>
          <mesh>
            <sphereGeometry
              args={[
                r,
                DEFAULT_SEGMENTS.sphereWidth,
                DEFAULT_SEGMENTS.sphereHeight,
                0,
                Math.PI * 2,
                0,
                Math.PI / 2,
              ]}
            />
            {materialNode}
          </mesh>
          {/* Cap the open end with a circle on the equator */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[r, DEFAULT_SEGMENTS.sphereWidth]} />
            {materialNode}
          </mesh>
        </group>
      );
    }
  }
}
