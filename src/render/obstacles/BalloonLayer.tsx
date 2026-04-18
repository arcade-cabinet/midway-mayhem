/**
 * BalloonLayer — Feature A (Balloon Alley).
 *
 * Renders floating balloon pickups drifting across lanes as colored spheres
 * with string lines trailing down. Drives off the pre-baked
 * `state.plan.balloons` list when available so every balloon anchor is
 * deterministic from the run seed and visible from afar as soon as the
 * player enters the corridor. Falls back to `window.__mmBalloonSpawner`
 * (the legacy streaming spawner) when there is no plan — needed for unit
 * tests that mount the layer in isolation.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
// TODO(gameState): useGameStore from the in-flight gameState port
import { useGameStore } from '@/game/gameState';
import { trackToWorld } from '@/game/obstacles/trackToWorld';
import type { PlannedBalloonAnchor } from '@/game/runPlan';
import { composeTrack, DEFAULT_TRACK } from '@/track/trackComposer';

const MAX_BALLOONS = 32;
/** Render plan balloons within this forward window (metres). */
const FORWARD_RENDER_M = 400;
/** Render plan balloons within this behind window (metres). */
const BEHIND_RENDER_M = 30;

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

/**
 * Current lateral for a plan-baked anchor given elapsed seconds since
 * drift began. Mirrors the ease-in-out curve from the legacy spawner.
 */
function plannedBalloonLateral(anchor: PlannedBalloonAnchor, elapsedS: number): number {
  if (elapsedS <= anchor.driftStart) return anchor.startLateral;
  const into = elapsedS - anchor.driftStart;
  const t = Math.min(1, into / anchor.driftDuration);
  const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  return anchor.startLateral + (anchor.endLateral - anchor.startLateral) * ease;
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

    const now = performance.now();
    const plan = s.plan;
    let count = 0;

    if (plan) {
      const playerD = s.distance;
      const minD = playerD - BEHIND_RENDER_M;
      const maxD = playerD + FORWARD_RENDER_M;
      const elapsedS = s.startedAt > 0 ? (now - s.startedAt) / 1000 : 0;

      for (const anchor of plan.balloons) {
        if (count >= MAX_BALLOONS) break;
        if (anchor.d < minD || anchor.d > maxD) continue;
        const lat = plannedBalloonLateral(anchor, elapsedS);
        const world = trackToWorld(composition, anchor.d, lat);
        const slot = slots.current[count];
        if (!slot) continue;

        const mat = getBalMat(anchor.color);
        slot.balloonMesh.material = mat;
        slot.balloonMesh.position.set(world.x, world.y + 3.5, world.z);
        slot.stringMesh.position.set(world.x, world.y + 2.5, world.z);
        count++;
      }
    } else {
      // biome-ignore lint/suspicious/noExplicitAny: gimmick spawner
      const balloonSpawner = (window as any).__mmBalloonSpawner;
      if (!balloonSpawner) return;

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
    }

    // Hide unused
    for (let i = count; i < slots.current.length; i++) {
      const sl = slots.current[i];
      if (sl) {
        sl.balloonMesh.position.set(0, -9999, 0);
        sl.stringMesh.position.set(0, -9999, 0);
      }
    }

    // biome-ignore lint/suspicious/noExplicitAny: diagnostics
    (window as any).__mmDiag_balloons = count;
  });

  return <group ref={groupRef} data-testid="balloon-layer" />;
}
