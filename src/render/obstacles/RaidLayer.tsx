/**
 * RaidLayer — Feature B (Ringmaster Raids).
 *
 * Renders active raid entities: TIGER, KNIVES, CANNONBALL.
 * Uses cow.glb placeholder for TIGER (orange material override),
 * thin box meshes for KNIVES, black sphere for CANNONBALL.
 *
 * Reads raid state from `window.__mmRaidDirector` (set by ObstacleSystem
 * which owns the RaidDirector instance). This pattern avoids a direct
 * zustand/context dependency in the renderer.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '@/game/gameState';
import type { RaidState } from '@/game/obstacles/raidDirector';

const KNIFE_GEO = new THREE.BoxGeometry(0.15, 0.8, 0.05);
const CANNONBALL_GEO = new THREE.SphereGeometry(0.5, 16, 12);
const SMOKE_GEO = new THREE.SphereGeometry(0.3, 8, 6);
// Primitive "tiger" — orange rounded box silhouette. Stays on-brand with
// the rest of the procedural visuals; Kenney GLBs land in a later PR.
const TIGER_BODY_GEO = new THREE.BoxGeometry(1.8, 0.8, 0.6);
const TIGER_HEAD_GEO = new THREE.SphereGeometry(0.35, 12, 10);

const KNIFE_MAT = new THREE.MeshStandardMaterial({
  color: '#bfbfbf',
  metalness: 0.9,
  roughness: 0.1,
});
const CANNONBALL_MAT = new THREE.MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.7 });
const SMOKE_MAT = new THREE.MeshStandardMaterial({
  color: '#4a4a4a',
  transparent: true,
  opacity: 0.5,
});
const TIGER_MAT = new THREE.MeshStandardMaterial({ color: '#f36f21', roughness: 0.6 });

export function RaidLayer() {
  const groupRef = useRef<THREE.Group>(null);
  const tigerRef = useRef<THREE.Object3D | null>(null);
  const knifeRefs = useRef<THREE.Mesh[]>([]);
  const smokeRefs = useRef<THREE.Mesh[]>([]);
  const cannonballRef = useRef<THREE.Mesh | null>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Build pools once
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;

    // Tiger: primitive composite (body + head). Swap for a GLB when
    // Kenney assets land under public/models/.
    if (!tigerRef.current) {
      const tigerGroup = new THREE.Group();
      const body = new THREE.Mesh(TIGER_BODY_GEO, TIGER_MAT);
      body.position.set(0, 0, 0);
      tigerGroup.add(body);
      const head = new THREE.Mesh(TIGER_HEAD_GEO, TIGER_MAT);
      head.position.set(0.9, 0.3, 0);
      tigerGroup.add(head);
      tigerGroup.position.set(0, -9999, 0);
      g.add(tigerGroup);
      tigerRef.current = tigerGroup;
    }

    // Knives: 5 mesh slots
    if (knifeRefs.current.length === 0) {
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(KNIFE_GEO, KNIFE_MAT);
        m.position.set(0, -9999, 0);
        g.add(m);
        knifeRefs.current.push(m);
      }
    }

    // Cannonball
    if (!cannonballRef.current) {
      const cb = new THREE.Mesh(CANNONBALL_GEO, CANNONBALL_MAT);
      cb.position.set(0, -9999, 0);
      g.add(cb);
      cannonballRef.current = cb;
    }

    // Smoke puffs for cannonball trail
    if (smokeRefs.current.length === 0) {
      for (let i = 0; i < 6; i++) {
        const sm = new THREE.Mesh(SMOKE_GEO, SMOKE_MAT.clone() as THREE.MeshStandardMaterial);
        sm.position.set(0, -9999, 0);
        g.add(sm);
        smokeRefs.current.push(sm);
      }
    }

    void dummy;
  });

  useFrame(({ clock }) => {
    const s = useGameStore.getState();
    if (!s.running) {
      hideAll();
      return;
    }

    // biome-ignore lint/suspicious/noExplicitAny: raid system
    const raidDirector = (window as any).__mmRaidDirector;
    if (!raidDirector) {
      throw new Error('RaidLayer: __mmRaidDirector is not set — ObstacleSystem must mount first');
    }

    const raidState = raidDirector.getState() as RaidState | null;
    if (!raidState || raidState.phase === 'idle' || raidState.phase === 'cleanup') {
      hideAll();
      return;
    }

    const t = clock.elapsedTime;
    const activeDt = (performance.now() - raidState.startedAt - raidState.telegraphDuration) / 1000;

    if (raidState.kind === 'TIGER') {
      renderTiger(raidState, activeDt);
    } else if (raidState.kind === 'KNIVES') {
      renderKnives(raidState, t);
    } else if (raidState.kind === 'CANNONBALL') {
      renderCannonball(raidState, activeDt, t);
    }
  });

  function renderTiger(raidState: RaidState, activeDt: number) {
    const tiger = tigerRef.current;
    if (!tiger) return;
    hideKnives();
    hideCb();

    // Tiger crosses track laterally
    const progress = Math.min(1, Math.max(0, activeDt / (raidState.activeDuration / 1000)));
    const lat = -8 + progress * 16; // -8 to +8 world units
    tiger.position.set(lat, 0.5, -12); // 12m ahead of player
    tiger.rotation.set(0, Math.PI / 2, 0); // facing across track
  }

  function renderKnives(raidState: RaidState, t: number) {
    hideTiger();
    hideCb();
    const knives = raidState.knives ?? [];
    for (let i = 0; i < 5; i++) {
      const knife = knifeRefs.current[i];
      if (!knife) continue;
      const knifeData = knives[i];
      if (!knifeData || knifeData.hit || knifeData.dodged) {
        knife.position.set(0, -9999, 0);
        continue;
      }
      const timeToFall = (knifeData.dropAt - performance.now()) / 1000;
      const laneX = (knifeData.lane - 1) * 3.3;
      if (timeToFall > 0) {
        // Still in air — show dropping
        const startY = 8;
        const y = startY - Math.max(0, (1 - timeToFall) * startY);
        knife.position.set(laneX, y, -8 - i * 1.5);
        knife.rotation.set(t * 4, 0, 0); // spinning
      } else {
        knife.position.set(laneX, -0.2, -8 - i * 1.5); // stuck in ground
        knife.rotation.set(0.3, 0, 0);
      }
    }
  }

  function renderCannonball(raidState: RaidState, activeDt: number, t: number) {
    hideTiger();
    hideKnives();
    const cb = cannonballRef.current;
    if (!cb) return;

    if (raidState.cannonballDodged) {
      cb.position.set(0, -9999, 0);
      for (const sm of smokeRefs.current) sm.position.set(0, -9999, 0);
      return;
    }

    // Cannonball launches from side wall and travels to the targeted lane
    const progress = Math.min(1, Math.max(0, activeDt / (raidState.activeDuration / 1000)));
    const startX = -12;
    const targetLaneX = ((raidState.cannonballLane ?? 1) - 1) * 3.3;
    const x = startX + (targetLaneX - startX) * progress;
    cb.position.set(x, 1.5, -6);

    // Smoke trail behind cannonball
    for (let i = 0; i < smokeRefs.current.length; i++) {
      const sm = smokeRefs.current[i];
      if (!sm) continue;
      const delay = i * 0.15;
      const prevX = x - delay * 6;
      if (prevX < startX || prevX > targetLaneX) {
        sm.position.set(0, -9999, 0);
        continue;
      }
      sm.position.set(prevX, 1.5 + Math.sin(t * 4 + i) * 0.2, -6);
      const mat = sm.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.3 + Math.sin(t * 6 + i) * 0.2;
    }
  }

  function hideTiger() {
    if (tigerRef.current) tigerRef.current.position.set(0, -9999, 0);
  }
  function hideKnives() {
    for (const k of knifeRefs.current) k.position.set(0, -9999, 0);
  }
  function hideCb() {
    if (cannonballRef.current) cannonballRef.current.position.set(0, -9999, 0);
    for (const sm of smokeRefs.current) sm.position.set(0, -9999, 0);
  }
  function hideAll() {
    hideTiger();
    hideKnives();
    hideCb();
  }

  return <group ref={groupRef} data-testid="raid-layer" />;
}
