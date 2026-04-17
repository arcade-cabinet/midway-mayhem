/**
 * @module modes/tour/TourArenaProps
 *
 * Instanced arena props for BigTopTour: tent tops, circus poles, spotlight
 * cones, and per-color balloon clusters.
 * Extracted from BigTopTour.tsx to keep that file under 300 LOC.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// ─── Position arrays (filled at module init) ─────────────────────────────────

const TENT_POSITIONS: Array<[number, number, number]> = [];
const BALLOON_POSITIONS: Array<[number, number, number]> = [];
const POLE_POSITIONS: Array<[number, number, number]> = [];

for (let i = 0; i < 24; i++) {
  const z = -5 - i * 9;
  const side = i % 2 === 0 ? 1 : -1;
  TENT_POSITIONS.push([side * 14, 0, z]);
  POLE_POSITIONS.push([side * 18, 0, z - 3]);
}
for (let i = 0; i < 32; i++) {
  const z = -8 - i * 6;
  const side = i % 3 === 0 ? 1 : i % 3 === 1 ? -1 : 0;
  BALLOON_POSITIONS.push([side * 10 + (i % 2 === 0 ? 2 : -2), 3 + (i % 4), z]);
}

// ─── Shared geometries + materials (module-level singletons) ─────────────────

const _tentGeo = new THREE.ConeGeometry(2.5, 5, 8);
const _poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 14, 8);
const _balloonGeo = new THREE.SphereGeometry(0.5, 8, 6);
const _spotlightGeo = new THREE.CylinderGeometry(0.0, 1.2, 6, 12, 1, true);

const _tentMat = new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.7 });
const _poleMat = new THREE.MeshStandardMaterial({
  color: 0xffd600,
  metalness: 0.6,
  roughness: 0.3,
});
const _balloonColorList = [0xe53935, 0xffd600, 0x1e88e5, 0x8e24aa, 0xf36f21];
const _spotlightMat = new THREE.MeshBasicMaterial({
  color: 0xffffcc,
  transparent: true,
  opacity: 0.08,
  side: THREE.BackSide,
});

// ─── Components ───────────────────────────────────────────────────────────────

export function TourArenaProps() {
  const tentRef = useRef<THREE.InstancedMesh>(null);
  const poleRef = useRef<THREE.InstancedMesh>(null);
  const spotRef = useRef<THREE.InstancedMesh>(null);
  const d = useRef(new THREE.Object3D()).current;

  useEffect(() => {
    if (tentRef.current) {
      TENT_POSITIONS.forEach(([x, y, z], i) => {
        d.position.set(x, y + 2.5, z);
        d.rotation.set(0, (i * 0.7) % (Math.PI * 2), 0);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        tentRef.current?.setMatrixAt(i, d.matrix);
      });
      tentRef.current.instanceMatrix.needsUpdate = true;
    }
    if (poleRef.current) {
      POLE_POSITIONS.forEach(([x, y, z], i) => {
        d.position.set(x, y + 7, z);
        d.rotation.set(0, 0, 0);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        poleRef.current?.setMatrixAt(i, d.matrix);
      });
      poleRef.current.instanceMatrix.needsUpdate = true;
    }
    if (spotRef.current) {
      POLE_POSITIONS.forEach(([x, , z], i) => {
        d.position.set(x * 0.6, 18, z);
        d.rotation.set(0, 0, Math.PI);
        d.scale.set(1, 1, 1);
        d.updateMatrix();
        spotRef.current?.setMatrixAt(i, d.matrix);
      });
      spotRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [d]);

  return (
    <>
      <instancedMesh ref={tentRef} args={[_tentGeo, _tentMat, TENT_POSITIONS.length]} />
      <instancedMesh ref={poleRef} args={[_poleGeo, _poleMat, POLE_POSITIONS.length]} />
      <instancedMesh ref={spotRef} args={[_spotlightGeo, _spotlightMat, POLE_POSITIONS.length]} />
      {_balloonColorList.map((c, ci) => (
        <BalloonCluster key={c} colorHex={c} slotIndex={ci} />
      ))}
    </>
  );
}

function BalloonCluster({ colorHex, slotIndex }: { colorHex: number; slotIndex: number }) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const mat = useRef(
    new THREE.MeshStandardMaterial({ color: colorHex, metalness: 0.35, roughness: 0.2 }),
  );
  const d = useRef(new THREE.Object3D()).current;
  const mine = BALLOON_POSITIONS.filter((_, i) => i % 5 === slotIndex);

  useEffect(() => {
    if (!meshRef.current || mine.length === 0) return;
    mine.forEach(([x, y, z], i) => {
      d.position.set(x, y, z);
      d.rotation.set(0, 0, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      meshRef.current?.setMatrixAt(i, d.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [mine, d]);

  if (mine.length === 0) return null;
  return <instancedMesh ref={meshRef} args={[_balloonGeo, mat.current, mine.length]} />;
}
