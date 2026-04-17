/**
 * FireHoopGate — Feature A (Ring of Fire zone gimmick).
 *
 * Renders torus gates with emissive orange glow + 20 ember particles (InstancedMesh).
 * Passing within 2m of ring center = "perfect" bonus + combo event.
 * Missing by >2m = light damage + visual sparks.
 *
 * Gates are placed at fixed d-intervals within the zone, driven by a shared
 * singleton array exposed via window.__mmFireHoops.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { composeTrack, DEFAULT_TRACK } from '@/track/trackComposer';
import { useGameStore } from '@/game/gameState';
import { laneCenterX } from '@/utils/constants';
import { trackToWorld } from './ObstacleSystem';

const HOOP_INTERVAL = 60; // meters between hoops within the zone
const ZONE_START = 900;   // ring-of-fire zone start distance
const ZONE_LENGTH = 450;
const HOOP_RADIUS = 3.2;
const EMBER_COUNT = 20;
const PASS_BONUS_LATERAL_M = 2; // within this = perfect pass
const MISS_DAMAGE_LATERAL_M = 4; // beyond this on either side = miss (scrape)

interface FireHoop {
  d: number;
  lane: number; // center lane for hoop
  passed: boolean;
  missChecked: boolean;
}

function buildHoopList(): FireHoop[] {
  const hoops: FireHoop[] = [];
  for (let d = ZONE_START + 30; d < ZONE_START + ZONE_LENGTH - 20; d += HOOP_INTERVAL) {
    hoops.push({
      d,
      lane: 1, // center lane
      passed: false,
      missChecked: false,
    });
  }
  return hoops;
}

const TORUS_GEO = new THREE.TorusGeometry(HOOP_RADIUS, 0.3, 16, 48);
const EMBER_GEO = new THREE.BoxGeometry(0.12, 0.12, 0.12);
const TORUS_MAT = new THREE.MeshStandardMaterial({
  color: '#f36f21',
  emissive: '#ff3b00',
  emissiveIntensity: 2.5,
  roughness: 0.3,
});
const EMBER_MAT = new THREE.MeshStandardMaterial({
  color: '#ffd600',
  emissive: '#ff6600',
  emissiveIntensity: 3.0,
  roughness: 0.8,
});

export function FireHoopGate() {
  const hoops = useRef<FireHoop[]>(buildHoopList());
  const groupRef = useRef<THREE.Group>(null);
  const torusRefs = useRef<THREE.Mesh[]>([]);
  const emberRefs = useRef<THREE.InstancedMesh[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const composition = useMemo(() => composeTrack(DEFAULT_TRACK, 10), []);

  // Expose hoops for diagnostics
  useFrame(() => {
    // biome-ignore lint/suspicious/noExplicitAny: diagnostics
    (window as any).__mmFireHoops = hoops.current;
    // biome-ignore lint/suspicious/noExplicitAny: diagnostics
    (window as any).__mmDiag_hoops = hoops.current.length;
  });

  // Build mesh pool once
  useFrame(() => {
    const g = groupRef.current;
    if (!g || torusRefs.current.length > 0) return;
    for (const hoop of hoops.current) {
      const torus = new THREE.Mesh(TORUS_GEO, TORUS_MAT);
      torus.position.set(0, -9999, 0);
      g.add(torus);
      torusRefs.current.push(torus);

      const embers = new THREE.InstancedMesh(EMBER_GEO, EMBER_MAT, EMBER_COUNT);
      embers.position.set(0, -9999, 0);
      g.add(embers);
      emberRefs.current.push(embers);

      void hoop; // silence lint
    }
  });

  useFrame(({ clock }) => {
    const s = useGameStore.getState();
    if (!s.running) return;

    const t = clock.elapsedTime;
    const nowMs = performance.now();

    for (let idx = 0; idx < hoops.current.length; idx++) {
      const hoop = hoops.current[idx];
      if (!hoop) continue;

      const torus = torusRefs.current[idx];
      const embers = emberRefs.current[idx];
      if (!torus || !embers) continue;

      const hoopLat = laneCenterX(hoop.lane);
      const world = trackToWorld(composition, hoop.d, hoopLat);

      // Visible range: 150m ahead of player
      const distAhead = hoop.d - s.distance;
      if (distAhead < -20 || distAhead > 150) {
        torus.position.set(0, -9999, 0);
        embers.position.set(0, -9999, 0);
        // Reset hoop for zone cycling
        if (distAhead < -20) {
          hoop.passed = false;
          hoop.missChecked = false;
        }
        continue;
      }

      // Position the torus ring (vertical orientation — player drives through)
      torus.position.set(world.x, world.y + HOOP_RADIUS, world.z);
      torus.rotation.set(Math.PI / 2, world.heading, 0);

      // Ember particles orbiting the ring
      embers.position.set(world.x, world.y + HOOP_RADIUS, world.z);
      embers.rotation.set(Math.PI / 2, world.heading, 0);
      for (let e = 0; e < EMBER_COUNT; e++) {
        const angle = (e / EMBER_COUNT) * Math.PI * 2 + t * 1.5;
        const r = HOOP_RADIUS + Math.sin(t * 3 + e) * 0.3;
        dummy.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
        // Animated Y flutter
        dummy.position.y += Math.sin(t * 6 + e * 0.7) * 0.15;
        dummy.scale.setScalar(0.5 + Math.sin(t * 8 + e) * 0.3);
        dummy.updateMatrix();
        embers.setMatrixAt(e, dummy.matrix);
      }
      embers.instanceMatrix.needsUpdate = true;

      // Collision check: within 3m of hoop along track
      if (Math.abs(distAhead) < 3 && !hoop.passed && !hoop.missChecked) {
        const lateralDiff = Math.abs(s.lateral - hoopLat);
        if (lateralDiff < PASS_BONUS_LATERAL_M) {
          // Perfect pass
          hoop.passed = true;
          hoop.missChecked = true;
          useGameStore.setState((prev) => ({ crowdReaction: prev.crowdReaction + 75 }));
          // biome-ignore lint/suspicious/noExplicitAny: diagnostics
          (window as any).__mmDiag_hoopPerfect = ((window as any).__mmDiag_hoopPerfect ?? 0) + 1;
        } else if (lateralDiff < MISS_DAMAGE_LATERAL_M) {
          // Partial scrape
          hoop.missChecked = true;
          useGameStore.getState().applyCrash(false);
          void nowMs;
        } else {
          // Full miss — no penalty
          hoop.missChecked = true;
        }
      }
    }
  });

  return <group ref={groupRef} data-testid="fire-hoop-gate" />;
}
