import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
// TODO(gameState): useGameStore from the in-flight gameState port
import { useGameStore } from '@/game/gameState';
import { composeTrack, DEFAULT_TRACK } from '@/track/trackComposer';
import { laneCenterX } from '@/utils/constants';
import { trackToWorld } from '@/game/obstacles/trackToWorld';

/**
 * Pickup visuals. Consumes pre-baked `state.plan.pickups` when available
 * (pickups within the forward render window are drawn as spinning tokens),
 * falling back to the legacy streaming spawner (exposed on
 * `window.__mmSpawner`) only when no run plan exists. The crash-and-score
 * lane collision is handled inside ObstacleSystem; this layer only renders.
 */

/** Render plan pickups within this forward window (metres). */
const FORWARD_RENDER_M = 500;
/** Render plan pickups within this behind window (metres). */
const BEHIND_RENDER_M = 8;

export function PickupSystem() {
  const ringsRef = useRef<THREE.InstancedMesh>(null);
  const ticketsRef = useRef<THREE.InstancedMesh>(null);
  const megaRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const composition = useMemo(() => composeTrack(DEFAULT_TRACK, 10), []);

  const ringGeo = useMemo(() => new THREE.TorusGeometry(1.1, 0.18, 12, 20), []);
  const ticketGeo = useMemo(() => new THREE.BoxGeometry(0.7, 0.7, 0.1), []);
  const megaGeo = useMemo(() => new THREE.IcosahedronGeometry(1.1, 0), []);

  useFrame(({ clock }) => {
    const s = useGameStore.getState();
    if (!s.running) return;

    const refs = { boost: ringsRef.current, ticket: ticketsRef.current, mega: megaRef.current };
    const counts: Record<string, number> = { boost: 0, ticket: 0, mega: 0 };
    const spin = clock.elapsedTime * 2;
    const plan = s.plan;

    if (plan) {
      const playerD = s.distance;
      const minD = playerD - BEHIND_RENDER_M;
      const maxD = playerD + FORWARD_RENDER_M;
      for (const p of plan.pickups) {
        if (p.d < minD || p.d > maxD) continue;
        const m = refs[p.type as keyof typeof refs];
        if (!m) continue;
        const i = counts[p.type] ?? 0;
        if (i >= m.count) continue;
        const world = trackToWorld(composition, p.d, laneCenterX(p.lane));
        dummy.position.set(world.x, world.y + 1.8, world.z);
        dummy.rotation.set(0, spin + world.heading + p.yaw, p.type === 'boost' ? Math.PI / 2 : 0);
        dummy.scale.set(1, 1, 1);
        if (p.type === 'mega') dummy.scale.setScalar(1 + Math.sin(spin * 3) * 0.2);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        counts[p.type] = i + 1;
      }
    } else {
      // biome-ignore lint/suspicious/noExplicitAny: diagnostics
      const spawner = (window as any).__mmSpawner;
      if (!spawner) return;
      const list = spawner.getPickups();
      for (const p of list) {
        if (p.consumed) continue;
        const m = refs[p.type as keyof typeof refs];
        if (!m) continue;
        const i = counts[p.type] ?? 0;
        if (i >= m.count) continue;
        const world = trackToWorld(composition, p.d, laneCenterX(p.lane));
        dummy.position.set(world.x, world.y + 1.8, world.z);
        dummy.rotation.set(0, spin + world.heading, p.type === 'boost' ? Math.PI / 2 : 0);
        dummy.scale.set(1, 1, 1);
        if (p.type === 'mega') dummy.scale.setScalar(1 + Math.sin(spin * 3) * 0.2);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        counts[p.type] = i + 1;
      }
    }

    for (const [k, m] of Object.entries(refs)) {
      if (!m) continue;
      for (let i = counts[k] ?? 0; i < m.count; i++) {
        dummy.position.set(0, -9999, 0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group data-testid="pickup-system">
      <instancedMesh ref={ringsRef} args={[ringGeo, undefined, 30]}>
        <meshStandardMaterial color="#ffd600" emissive="#332200" emissiveIntensity={1.4} />
      </instancedMesh>
      <instancedMesh ref={ticketsRef} args={[ticketGeo, undefined, 60]}>
        <meshStandardMaterial color="#1E88E5" emissive="#001133" emissiveIntensity={1.1} />
      </instancedMesh>
      <instancedMesh ref={megaRef} args={[megaGeo, undefined, 8]}>
        <meshStandardMaterial color="#8E24AA" emissive="#220033" emissiveIntensity={1.5} />
      </instancedMesh>
    </group>
  );
}
