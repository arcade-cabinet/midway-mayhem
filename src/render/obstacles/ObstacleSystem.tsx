import { useGLTF } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { onHonk } from '@/audio/honkBus';
import { combo } from '@/game/comboSystem';
// TODO(gameState): useGameStore from the in-flight gameState port
import { useGameStore } from '@/game/gameState';
import { eventsRng } from '@/game/runRngBus';
import { ObstacleSpawner } from '@/game/obstacles/obstacleSpawner';
import { composeTrack, DEFAULT_TRACK } from '@/track/trackComposer';
import type { CritterKind } from '@/utils/constants';
import { HONK } from '@/utils/constants';
import {
  CRITTER_KINDS,
  type CritterPools,
  makeCritterPools,
  populateCritterKind,
} from '@/game/obstacles/critterPool';
import { type PlanFleeState, useObstacleFrame } from '@/game/obstacles/useObstacleFrame';

/**
 * Obstacles rendered via Kenney Racing Kit GLBs (baked with brand palette).
 *
 * When a pre-baked RunPlan is available (the common case) the system
 * renders plan entries directly. The legacy streaming ObstacleSpawner path
 * is retained as a fallback for unit tests / diagnostics.
 *
 * Per-frame logic lives in useObstacleFrame.ts (extracted to stay under 300 LOC).
 *
 * NOTE: asset URLs use placeholder paths until src/assets/manifest.ts lands.
 * TODO(assets): replace bare paths with assetUrl() calls once manifest is ported.
 */

const MAX_PER_TYPE = 40;

// TODO(assets): replace with assetUrl() once src/assets/manifest.ts is ported.
const ASSET_BARRIER_RED = '/models/barrierRed.glb';
const ASSET_CONE = '/models/cone.glb';
const ASSET_PYLON = '/models/pylon.glb';
const ASSET_BARRIER_WALL = '/models/barrierWall.glb';
const ASSET_COW = '/models/critter_cow.glb';
const ASSET_HORSE = '/models/critter_horse.glb';
const ASSET_LLAMA = '/models/critter_llama.glb';
const ASSET_PIG = '/models/critter_pig.glb';

export function ObstacleSystem() {
  const seed = useGameStore((s) => s.seed);
  // biome-ignore lint/correctness/useExhaustiveDependencies: rebuild on seed change
  const spawner = useMemo(() => new ObstacleSpawner(eventsRng()), [seed]);
  const composition = useMemo(() => composeTrack(DEFAULT_TRACK, 10), []);

  const barrierGltf = useGLTF(ASSET_BARRIER_RED) as unknown as { scene: THREE.Object3D };
  const coneGltf = useGLTF(ASSET_CONE) as unknown as { scene: THREE.Object3D };
  const pylonGltf = useGLTF(ASSET_PYLON) as unknown as { scene: THREE.Object3D };
  const wallGltf = useGLTF(ASSET_BARRIER_WALL) as unknown as { scene: THREE.Object3D };
  const cowGltf = useGLTF(ASSET_COW) as unknown as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };
  const horseGltf = useGLTF(ASSET_HORSE) as unknown as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };
  const llamaGltf = useGLTF(ASSET_LLAMA) as unknown as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };
  const pigGltf = useGLTF(ASSET_PIG) as unknown as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };

  const critterScenes: Record<CritterKind, THREE.Object3D> = {
    cow: cowGltf.scene,
    horse: horseGltf.scene,
    llama: llamaGltf.scene,
    pig: pigGltf.scene,
  };
  const critterAnimations: Record<CritterKind, THREE.AnimationClip[]> = {
    cow: cowGltf.animations ?? [],
    horse: horseGltf.animations ?? [],
    llama: llamaGltf.animations ?? [],
    pig: pigGltf.animations ?? [],
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
          planFleeState.current.set(i, {
            fleeStartedAt: nowMs,
            fleeDir: rng.next() < 0.5 ? -1 : 1,
          });
          scared++;
        }
      } else {
        scared = spawner.scareCritters(s.distance, performance.now());
      }
      if (scared > 0) {
        for (let i = 0; i < scared; i++) combo.registerEvent('scare');
        const mult = combo.getMultiplier();
        useGameStore.setState({ crowdReaction: useGameStore.getState().crowdReaction + scared * 10 * mult });
      }
    });
  }, [spawner]);

  useEffect(() => {
    if (!barrierGroupRef.current || barrierSlots.current.length > 0) return;
    for (let i = 0; i < MAX_PER_TYPE; i++) {
      const b = barrierGltf.scene.clone(true);
      b.scale.setScalar(10);
      b.position.set(0, -9999, 0);
      barrierGroupRef.current?.add(b);
      barrierSlots.current.push(b);
      const c = coneGltf.scene.clone(true);
      c.scale.setScalar(10);
      c.position.set(0, -9999, 0);
      conesGroupRef.current?.add(c);
      conesSlots.current.push(c);
      const g = pylonGltf.scene.clone(true);
      g.scale.setScalar(10);
      g.position.set(0, -9999, 0);
      gateGroupRef.current?.add(g);
      gateSlots.current.push(g);
      const h = wallGltf.scene.clone(true);
      h.scale.setScalar(10);
      h.position.set(0, -9999, 0);
      hammerGroupRef.current?.add(h);
      hammerSlots.current.push(h);
      const o = new THREE.Mesh(oilGeo, oilMat);
      o.position.set(0, -9999, 0);
      oilGroupRef.current?.add(o);
      oilSlots.current.push(o);
    }
    if (critterGroupRef.current) {
      for (const kind of CRITTER_KINDS) {
        populateCritterKind(
          kind,
          critterScenes[kind],
          critterAnimations[kind],
          critterPools.current,
          critterGroupRef.current,
        );
      }
    }
  }, [
    barrierGltf,
    coneGltf,
    pylonGltf,
    wallGltf,
    oilGeo,
    oilMat,
    critterScenes.cow,
    critterScenes.horse,
    critterScenes.llama,
    critterScenes.pig,
    critterScenes,
    critterAnimations,
  ]);

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

useGLTF.preload(ASSET_BARRIER_RED);
useGLTF.preload(ASSET_BARRIER_WALL);
useGLTF.preload(ASSET_CONE);
useGLTF.preload(ASSET_PYLON);
useGLTF.preload(ASSET_COW);
useGLTF.preload(ASSET_HORSE);
useGLTF.preload(ASSET_LLAMA);
useGLTF.preload(ASSET_PIG);

// Re-export pickIdleClip for any callers that imported it from here previously
export { pickIdleClip } from '@/game/obstacles/critterPool';
// Re-export: world-transform used by peer obstacle layers
export { trackToWorld } from '@/game/obstacles/trackToWorld';
