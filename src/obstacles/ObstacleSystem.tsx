import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { assetUrl } from '@/assets/manifest';
import { onHonk } from '@/audio/honkBus';
import { combo } from '@/game/comboSystem';
import { useGameStore } from '@/game/gameState';
import { eventsRng } from '@/game/runRngBus';
import { ObstacleSpawner } from '@/obstacles/obstacleSpawner';
import { composeTrack, DEFAULT_TRACK } from '@/track/trackComposer';
import type { CritterKind } from '@/utils/constants';
import { HONK } from '@/utils/constants';
import {
  CRITTER_KINDS,
  makeCritterPools,
  populateCritterKind,
  type CritterPools,
} from './critterPool';
import { useObstacleFrame, type PlanFleeState } from './useObstacleFrame';

/**
 * Obstacles rendered via Kenney Racing Kit GLBs (baked with brand palette).
 *
 * When a pre-baked RunPlan is available (the common case) the system
 * renders plan entries directly. The legacy streaming ObstacleSpawner path
 * is retained as a fallback for unit tests / diagnostics.
 *
 * Per-frame logic lives in useObstacleFrame.ts (extracted to stay under 300 LOC).
 */

const MAX_PER_TYPE = 40;

export function ObstacleSystem() {
  const seed = useGameStore((s) => s.seed);
  // biome-ignore lint/correctness/useExhaustiveDependencies: rebuild on seed change
  const spawner = useMemo(() => new ObstacleSpawner(eventsRng()), [seed]);
  const composition = useMemo(() => composeTrack(DEFAULT_TRACK, 10), []);

  const barrierGltf = useGLTF(assetUrl('gltf:barrierRed')) as unknown as { scene: THREE.Object3D };
  const coneGltf = useGLTF(assetUrl('gltf:cone')) as unknown as { scene: THREE.Object3D };
  const pylonGltf = useGLTF(assetUrl('gltf:pylon')) as unknown as { scene: THREE.Object3D };
  const wallGltf = useGLTF(assetUrl('gltf:barrierWall')) as unknown as { scene: THREE.Object3D };
  const cowGltf = useGLTF(assetUrl('gltf:critter_cow')) as unknown as { scene: THREE.Object3D; animations: THREE.AnimationClip[] };
  const horseGltf = useGLTF(assetUrl('gltf:critter_horse')) as unknown as { scene: THREE.Object3D; animations: THREE.AnimationClip[] };
  const llamaGltf = useGLTF(assetUrl('gltf:critter_llama')) as unknown as { scene: THREE.Object3D; animations: THREE.AnimationClip[] };
  const pigGltf = useGLTF(assetUrl('gltf:critter_pig')) as unknown as { scene: THREE.Object3D; animations: THREE.AnimationClip[] };

  const critterScenes: Record<CritterKind, THREE.Object3D> = {
    cow: cowGltf.scene, horse: horseGltf.scene, llama: llamaGltf.scene, pig: pigGltf.scene,
  };
  const critterAnimations: Record<CritterKind, THREE.AnimationClip[]> = {
    cow: cowGltf.animations ?? [], horse: horseGltf.animations ?? [],
    llama: llamaGltf.animations ?? [], pig: pigGltf.animations ?? [],
  };

  const barrierGroupRef = useRef<THREE.Group>(null);
  const conesGroupRef = useRef<THREE.Group>(null);
  const gateGroupRef = useRef<THREE.Group>(null);
  const hammerGroupRef = useRef<THREE.Group>(null);
  const oilGroupRef = useRef<THREE.Group>(null);
  const critterGroupRef = useRef<THREE.Group>(null);

  const nearMissFiredIds = useRef<Set<number>>(new Set());
  const planFleeState = useRef<Map<number, PlanFleeState>>(new Map());
  const planCrashedIdx = useRef<Set<number>>(new Set());

  const barrierSlots = useRef<THREE.Object3D[]>([]);
  const conesSlots = useRef<THREE.Object3D[]>([]);
  const gateSlots = useRef<THREE.Object3D[]>([]);
  const hammerSlots = useRef<THREE.Object3D[]>([]);
  const oilSlots = useRef<THREE.Mesh[]>([]);
  const critterPools = useRef<CritterPools>(makeCritterPools());

  const oilGeo = useMemo(() => new THREE.CylinderGeometry(1.6, 1.6, 0.08, 24), []);
  const oilMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#0a0410', roughness: 0.3, metalness: 0.0 }),
    [],
  );

  useEffect(() => {
    // biome-ignore lint/suspicious/noExplicitAny: diagnostics
    (window as any).__mmSpawner = spawner;
  }, [spawner]);

  useEffect(() => {
    return onHonk(() => {
      const s = useGameStore.getState();
      if (!s.running) return;
      let scared = 0;
      if (s.plan) {
        const nowMs = performance.now();
        const rng = eventsRng();
        const playerD = s.distance;
        for (let i = 0; i < s.plan.obstacles.length; i++) {
          const o = s.plan.obstacles[i];
          if (!o || o.type !== 'critter') continue;
          if (planFleeState.current.has(i)) continue;
          const ahead = o.d - playerD;
          if (ahead < 0 || ahead > HONK.SCARE_RADIUS_M) continue;
          planFleeState.current.set(i, { fleeStartedAt: nowMs, fleeDir: rng.next() < 0.5 ? -1 : 1 });
          scared++;
        }
      } else {
        scared = spawner.scareCritters(s.distance, performance.now());
      }
      if (scared > 0) {
        for (let i = 0; i < scared; i++) combo.registerEvent('scare');
        const mult = combo.getMultiplier();
        useGameStore.setState((prev) => ({ crowdReaction: prev.crowdReaction + scared * 10 * mult }));
      }
    });
  }, [spawner]);

  useEffect(() => {
    if (!barrierGroupRef.current || barrierSlots.current.length > 0) return;
    for (let i = 0; i < MAX_PER_TYPE; i++) {
      const b = barrierGltf.scene.clone(true); b.scale.setScalar(10); b.position.set(0, -9999, 0);
      barrierGroupRef.current?.add(b); barrierSlots.current.push(b);
      const c = coneGltf.scene.clone(true); c.scale.setScalar(10); c.position.set(0, -9999, 0);
      conesGroupRef.current?.add(c); conesSlots.current.push(c);
      const g = pylonGltf.scene.clone(true); g.scale.setScalar(10); g.position.set(0, -9999, 0);
      gateGroupRef.current?.add(g); gateSlots.current.push(g);
      const h = wallGltf.scene.clone(true); h.scale.setScalar(10); h.position.set(0, -9999, 0);
      hammerGroupRef.current?.add(h); hammerSlots.current.push(h);
      const o = new THREE.Mesh(oilGeo, oilMat); o.position.set(0, -9999, 0);
      oilGroupRef.current?.add(o); oilSlots.current.push(o);
    }
    if (critterGroupRef.current) {
      for (const kind of CRITTER_KINDS) {
        populateCritterKind(kind, critterScenes[kind], critterAnimations[kind], critterPools.current, critterGroupRef.current);
      }
    }
  }, [barrierGltf, coneGltf, pylonGltf, wallGltf, oilGeo, oilMat, critterScenes.cow, critterScenes.horse, critterScenes.llama, critterScenes.pig, critterScenes, critterAnimations]);

  useObstacleFrame({
    barrierSlots,
    conesSlots,
    gateSlots,
    hammerSlots,
    oilSlots,
    critterPools,
    critterAnimations,
    nearMissFiredIds,
    planFleeState,
    planCrashedIdx,
    spawner,
    composition,
  });

  return (
    <group data-testid="obstacle-system">
      <group ref={barrierGroupRef} />
      <group ref={conesGroupRef} />
      <group ref={gateGroupRef} />
      <group ref={hammerGroupRef} />
      <group ref={oilGroupRef} />
      <group ref={critterGroupRef} />
    </group>
  );
}

useGLTF.preload(assetUrl('gltf:barrierRed'));
useGLTF.preload(assetUrl('gltf:barrierWhite'));
useGLTF.preload(assetUrl('gltf:barrierWall'));
useGLTF.preload(assetUrl('gltf:cone'));
useGLTF.preload(assetUrl('gltf:pylon'));
useGLTF.preload(assetUrl('gltf:critter_cow'));
useGLTF.preload(assetUrl('gltf:critter_horse'));
useGLTF.preload(assetUrl('gltf:critter_llama'));
useGLTF.preload(assetUrl('gltf:critter_pig'));

// ── Re-export: legacy world-transform used by peer obstacle layers ─────────
export { trackToWorld } from './trackToWorld';
// Re-export pickIdleClip for any callers that imported it from here previously
export { pickIdleClip } from './critterPool';
