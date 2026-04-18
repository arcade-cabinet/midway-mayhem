/**
 * FireHoopGate — Feature A (Ring of Fire zone gimmick).
 *
 * Renders torus gates with emissive orange glow + 20 ember particles
 * (InstancedMesh). Passing within 2m of ring center = "perfect" bonus +
 * combo event. Missing by >2m = light damage + visual sparks.
 *
 * Driven by the pre-baked `state.plan.fireHoops` list (every ring known
 * at run-start, placements baked from the track RNG). A legacy hardcoded
 * fallback list is used only when no plan is present, so unit tests that
 * mount the layer in isolation keep working.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { sampleTrackPose } from '@/ecs/systems/trackSampler';
import { useSampledTrack } from '@/ecs/systems/useSampledTrack';
import { useGameStore } from '@/game/gameState';
import { laneCenterX } from '@/utils/constants';

const DEFAULT_HOOP_RADIUS = 3.2;
const EMBER_COUNT = 20;
const PASS_BONUS_LATERAL_M = 2; // within this = perfect pass
const MISS_DAMAGE_LATERAL_M = 4; // beyond this on either side = miss (scrape)
/** Render hoops within this forward window (metres). */
const FORWARD_RENDER_M = 150;
const BEHIND_RENDER_M = 20;

interface FireHoop {
  d: number;
  lane: number;
  radius: number;
  passed: boolean;
  missChecked: boolean;
}

/** Fallback hoop list when no run plan is present (tests, diagnostics). */
function buildFallbackHoopList(): FireHoop[] {
  const ZONE_START = 900;
  const ZONE_LENGTH = 450;
  const HOOP_INTERVAL = 60;
  const hoops: FireHoop[] = [];
  for (let d = ZONE_START + 30; d < ZONE_START + ZONE_LENGTH - 20; d += HOOP_INTERVAL) {
    hoops.push({
      d,
      lane: 1,
      radius: DEFAULT_HOOP_RADIUS,
      passed: false,
      missChecked: false,
    });
  }
  return hoops;
}

const TORUS_GEO = new THREE.TorusGeometry(DEFAULT_HOOP_RADIUS, 0.3, 16, 48);
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
  // Seed with the fallback hoop list eagerly so tests that mount the layer
  // without a run (no plan) immediately have hoops to render. A live plan
  // replaces this on its first useFrame observation.
  const hoops = useRef<FireHoop[]>(buildFallbackHoopList());
  const groupRef = useRef<THREE.Group>(null);
  const torusRefs = useRef<THREE.Mesh[]>([]);
  const emberRefs = useRef<THREE.InstancedMesh[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const sampled = useSampledTrack();
  const lastPlanRef = useRef<unknown>(null);

  // Rebuild hoop list from plan on every plan-identity change, expose for
  // diagnostics, and (re)build the matching mesh pool to cover all hoops.
  useFrame(() => {
    const s = useGameStore.getState();
    const plan = s.plan;
    if (plan !== lastPlanRef.current) {
      lastPlanRef.current = plan;
      if (plan) {
        hoops.current = plan.fireHoops.map((h) => ({
          d: h.d,
          lane: h.lane,
          radius: h.radius,
          passed: false,
          missChecked: false,
        }));
      } else {
        // plan dropped to null — always rebuild to fallback so stale plan
        // hoops don't linger in the slot on the next lap or reset.
        hoops.current = buildFallbackHoopList();
      }
    }
    if (import.meta.env.DEV) {
      // biome-ignore lint/suspicious/noExplicitAny: diagnostics
      (window as any).__mmFireHoops = hoops.current;
      // biome-ignore lint/suspicious/noExplicitAny: diagnostics
      (window as any).__mmDiag_hoops = hoops.current.length;
    }
  });

  // Build mesh pool once the hoops list is populated. Sized to fit the
  // full run plan so every hoop has a reserved torus/ember pair.
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    while (torusRefs.current.length < hoops.current.length) {
      const torus = new THREE.Mesh(TORUS_GEO, TORUS_MAT);
      torus.position.set(0, -9999, 0);
      g.add(torus);
      torusRefs.current.push(torus);

      const embers = new THREE.InstancedMesh(EMBER_GEO, EMBER_MAT, EMBER_COUNT);
      embers.position.set(0, -9999, 0);
      g.add(embers);
      emberRefs.current.push(embers);
    }
  });

  useFrame(({ clock }) => {
    const s = useGameStore.getState();
    if (!s.running) return;

    const t = clock.elapsedTime;

    for (let idx = 0; idx < hoops.current.length; idx++) {
      const hoop = hoops.current[idx];
      if (!hoop) continue;

      const torus = torusRefs.current[idx];
      const embers = emberRefs.current[idx];
      if (!torus || !embers) continue;

      const hoopLat = laneCenterX(hoop.lane);
      if (sampled.length === 0) continue;
      const p = sampleTrackPose(sampled, hoop.d);
      const rightX = Math.cos(p.yaw);
      const rightZ = -Math.sin(p.yaw);
      const worldX = p.x + rightX * hoopLat;
      const worldZ = p.z + rightZ * hoopLat;

      // Visible range
      const distAhead = hoop.d - s.distance;
      if (distAhead < -BEHIND_RENDER_M || distAhead > FORWARD_RENDER_M) {
        torus.position.set(0, -9999, 0);
        embers.position.set(0, -9999, 0);
        if (distAhead < -BEHIND_RENDER_M) {
          // Reset hoop so a replay/lap can re-trigger if ever reused.
          hoop.passed = false;
          hoop.missChecked = false;
        }
        continue;
      }

      // Position the torus ring (vertical orientation — player drives through)
      torus.position.set(worldX, p.y + hoop.radius, worldZ);
      torus.rotation.set(Math.PI / 2, p.yaw, 0);

      // Ember particles orbiting the ring
      embers.position.set(worldX, p.y + hoop.radius, worldZ);
      embers.rotation.set(Math.PI / 2, p.yaw, 0);
      for (let e = 0; e < EMBER_COUNT; e++) {
        const angle = (e / EMBER_COUNT) * Math.PI * 2 + t * 1.5;
        const r = hoop.radius + Math.sin(t * 3 + e) * 0.3;
        dummy.position.set(Math.cos(angle) * r, Math.sin(angle) * r, 0);
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
          hoop.passed = true;
          hoop.missChecked = true;
          useGameStore.setState({ crowdReaction: useGameStore.getState().crowdReaction + 75 });
          if (import.meta.env.DEV) {
            // biome-ignore lint/suspicious/noExplicitAny: diagnostics
            (window as any).__mmDiag_hoopPerfect = ((window as any).__mmDiag_hoopPerfect ?? 0) + 1;
          }
        } else if (lateralDiff < MISS_DAMAGE_LATERAL_M) {
          hoop.missChecked = true;
          useGameStore.getState().applyCrash(false);
        } else {
          hoop.missChecked = true;
        }
      }
    }
  });

  return <group ref={groupRef} data-testid="fire-hoop-gate" />;
}
