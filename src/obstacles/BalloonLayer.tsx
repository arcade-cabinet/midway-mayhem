/**
 * BalloonLayer — Feature A (Balloon Alley).
 *
 * Renders floating balloon pickups drifting across lanes as colored spheres
 * with string lines trailing down. Active only in balloon-alley zone.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { composeTrack, DEFAULT_TRACK } from '@/track/trackComposer';
import { reportCounts } from '@/game/diagnosticsBus';
import { useGameStore } from '@/game/gameState';
import { trackToWorld } from './ObstacleSystem';

const MAX_BALLOONS = 32;

/** String geometry: a thin line dropping down ~2m from balloon. */
const STRING_GEO = new THREE.CylinderGeometry(0.02, 0.02, 2.0, 4);

/** Balloon geometry */
const BALLOON_GEO = new THREE.SphereGeometry(0.6, 12, 8);

/** Pre-built materials keyed by hex color string */
const matCache = new Map<string, THREE.MeshStandardMaterial>();
function getBalMat(hex: string): THREE.MeshStandardMaterial {
  let m = matCache.get(hex);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(hex),
      emissive: new THREE.Color(hex).multiplyScalar(0.2),
      roughness: 0.45,
    });
    matCache.set(hex, m);
  }
  return m;
}

const STRING_MAT = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1 });

interface BalloonSlot {
  balloonMesh: THREE.Mesh;
  stringMesh: THREE.Mesh;
}

export function BalloonLayer() {
  const groupRef = useRef<THREE.Group>(null);
  const slots = useRef<BalloonSlot[]>([]);
  const composition = useMemo(() => composeTrack(DEFAULT_TRACK, 10), []);

  // Build pool once
  useFrame(() => {
    const g = groupRef.current;
    if (!g || slots.current.length > 0) return; // already built
    for (let i = 0; i < MAX_BALLOONS; i++) {
      const balloonMesh = new THREE.Mesh(BALLOON_GEO, STRING_MAT.clone());
      balloonMesh.position.set(0, -9999, 0);
      const stringMesh = new THREE.Mesh(STRING_GEO, STRING_MAT);
      stringMesh.position.set(0, -9999, 0);
      g.add(balloonMesh);
      g.add(stringMesh);
      slots.current.push({ balloonMesh, stringMesh });
    }
  });

  useFrame(() => {
    const s = useGameStore.getState();
    if (!s.running) return;
    // biome-ignore lint/suspicious/noExplicitAny: gimmick spawner
    const balloonSpawner = (window as any).__mmBalloonSpawner;
    if (!balloonSpawner) return;

    const now = performance.now();
    const balloons = balloonSpawner.getBalloons() as Array<{
      id: number;
      d: number;
      color: string;
      consumed: boolean;
      startLateral: number;
      targetLateral: number;
      driftDuration: number;
      spawnedAt: number;
    }>;

    let count = 0;
    for (const b of balloons) {
      if (b.consumed) continue;
      if (count >= MAX_BALLOONS) break;
      const lat = balloonSpawner.balloonLateral(b, now) as number;
      const world = trackToWorld(composition, b.d, lat);
      const slot = slots.current[count];
      if (!slot) continue;

      const mat = getBalMat(b.color);
      slot.balloonMesh.material = mat;
      slot.balloonMesh.position.set(world.x, world.y + 3.5, world.z);

      slot.stringMesh.position.set(world.x, world.y + 2.5, world.z);

      count++;
    }

    // Hide unused
    for (let i = count; i < slots.current.length; i++) {
      const sl = slots.current[i];
      if (sl) {
        sl.balloonMesh.position.set(0, -9999, 0);
        sl.stringMesh.position.set(0, -9999, 0);
      }
    }

    reportCounts(
      useGameStore.getState().airborne ? 0 : 0, // don't overwrite obstacle count
      0,
      count,
    );
    // biome-ignore lint/suspicious/noExplicitAny: diagnostics
    (window as any).__mmDiag_balloons = count;
  });

  return <group ref={groupRef} data-testid="balloon-layer" />;
}
