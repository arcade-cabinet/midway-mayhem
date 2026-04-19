/**
 * @module obstacles/useObstacleFrame
 *
 * Per-frame logic for ObstacleSystem: position obstacles, animate critters,
 * hide unused slots, and run collision/near-miss/pickup detection.
 *
 * Separated from ObstacleSystem.tsx — ObstacleSystem is a React tree
 * (meshes, groups, refs) while this file is the per-frame update loop
 * that reads refs + game state and mutates transforms.
 */
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { audioBus } from '@/audio/audioBus';
import { tunables } from '@/config';
import { combo } from '@/game/comboSystem';
import { useGameStore } from '@/game/gameState';
import type { ObstacleSpawner } from '@/game/obstacles/obstacleSpawner';
import { eventsRng } from '@/game/runRngBus';
import type { ComposedTrack } from '@/track/trackComposer';
import type { CritterKind, ObstacleType } from '@/utils/constants';
import { HONK, laneCenterX, TRACK } from '@/utils/constants';
import { type CritterPools, seedMixerPhase } from './critterPool';
import { trackToWorld } from './trackToWorld';

interface PlanFleeState {
  fleeStartedAt: number;
  fleeDir: -1 | 1;
}

interface FrameRefs {
  barrierSlots: React.MutableRefObject<THREE.Object3D[]>;
  conesSlots: React.MutableRefObject<THREE.Object3D[]>;
  gateSlots: React.MutableRefObject<THREE.Object3D[]>;
  hammerSlots: React.MutableRefObject<THREE.Object3D[]>;
  oilSlots: React.MutableRefObject<THREE.Mesh[]>;
  critterPools: React.MutableRefObject<CritterPools>;
  critterAnimations: Record<CritterKind, THREE.AnimationClip[]>;
  nearMissFiredIds: React.MutableRefObject<Set<number>>;
  planFleeState: React.MutableRefObject<Map<number, PlanFleeState>>;
  planCrashedIdx: React.MutableRefObject<Set<number>>;
  spawner: ObstacleSpawner;
  composition: ComposedTrack;
}

export type { PlanFleeState };

const FORWARD_RENDER_M = tunables.obstacles.forwardRenderM;
const BEHIND_RENDER_M = tunables.obstacles.behindRenderM;
const NEAR_MISS_LATERAL = tunables.obstacles.nearMissLateral;
const NEAR_MISS_DIST = tunables.obstacles.nearMissDist;

export function useObstacleFrame(refs: FrameRefs): void {
  useFrame((_state, dt) => {
    const s = useGameStore.getState();
    if (!s.running) return;
    const plan = s.plan;
    const nowMs = performance.now();
    const now = nowMs * 0.001;
    const counters = { barrier: 0, cones: 0, gate: 0, hammer: 0, oil: 0, critter: 0 };
    const critterCounters: Record<CritterKind, number> = { cow: 0, horse: 0, llama: 0, pig: 0 };

    for (const kind of ['cow', 'horse', 'llama', 'pig'] as CritterKind[]) {
      for (const mx of refs.critterPools.current.mixers[kind]) mx.update(dt);
    }

    if (plan) {
      const playerD = s.distance;
      const minD = playerD - BEHIND_RENDER_M;
      const maxD = playerD + FORWARD_RENDER_M;
      for (let idx = 0; idx < plan.obstacles.length; idx++) {
        const o = plan.obstacles[idx];
        if (!o || o.d < minD || o.d > maxD) continue;
        const world = trackToWorld(refs.composition, o.d, laneCenterX(o.lane));
        const y = world.y + 0.1;
        let x = world.x;
        if (o.type === 'hammer') x += Math.sin(now * 2 + o.yaw) * 3;
        let extraLateral = 0,
          hopY = 0,
          tumble = 0;
        const flee = o.type === 'critter' ? refs.planFleeState.current.get(idx) : undefined;
        if (flee) {
          const elapsed = (nowMs - flee.fleeStartedAt) / 1000;
          const tHop = Math.min(1, elapsed / HONK.FLEE_DURATION_S);
          const easeHop = 1 - (1 - tHop) ** 3;
          extraLateral = flee.fleeDir * HONK.FLEE_LATERAL_M * easeHop;
          hopY = Math.sin(tHop * Math.PI) * 0.8;
          if (elapsed > HONK.FLEE_DURATION_S) {
            const fall = elapsed - HONK.FLEE_DURATION_S;
            extraLateral += flee.fleeDir * fall * 6;
            hopY -= fall * fall * 9;
            tumble = fall * 8;
          }
        }
        if (o.type === 'critter') {
          const rightX = Math.cos(world.heading),
            rightZ = -Math.sin(world.heading);
          x += rightX * extraLateral;
          const cz = world.z + rightZ * extraLateral;
          const kind = o.critter ?? 'cow';
          const pool = refs.critterPools.current.slots[kind];
          const slotIdx = critterCounters[kind];
          if (slotIdx >= pool.length) continue;
          const slot = pool[slotIdx] as THREE.Object3D;
          slot.position.set(x, y + hopY, cz);
          const heading = world.heading + (flee ? (Math.PI / 2) * flee.fleeDir : 0);
          slot.rotation.set(tumble, heading + Math.sin(now * 3 + o.yaw) * 0.08, tumble * 0.6);
          const mixer = refs.critterPools.current.mixers[kind][slotIdx];
          if (mixer) seedMixerPhase(slot, mixer, refs.critterAnimations[kind], idx, o.idlePhase);
          critterCounters[kind]++;
          counters.critter++;
          continue;
        }
        const slots =
          o.type === 'barrier'
            ? refs.barrierSlots.current
            : o.type === 'cones'
              ? refs.conesSlots.current
              : o.type === 'gate'
                ? refs.gateSlots.current
                : o.type === 'hammer'
                  ? refs.hammerSlots.current
                  : refs.oilSlots.current;
        const i = counters[o.type];
        if (i >= slots.length) continue;
        const slot = slots[i] as THREE.Object3D;
        slot.position.set(x, y, world.z);
        slot.rotation.set(0, world.heading + o.yaw, 0);
        if (o.type === 'hammer') slot.rotation.z = Math.sin(now * 2 + o.yaw) * 0.3;
        counters[o.type]++;
      }
    } else {
      refs.spawner.update(s.distance, s.currentZone);
      const list = refs.spawner.getObstacles();
      for (const o of list) {
        const world = trackToWorld(refs.composition, o.d, laneCenterX(o.lane));
        const y = world.y + 0.1;
        let x = world.x;
        if (o.type === 'hammer') x += Math.sin(now * 2 + o.swingPhase) * 3;
        let extraLateral = 0,
          hopY = 0,
          tumble = 0;
        if (o.type === 'critter' && o.fleeStartedAt && o.fleeDir) {
          const elapsed = (nowMs - o.fleeStartedAt) / 1000;
          const tHop = Math.min(1, elapsed / HONK.FLEE_DURATION_S);
          const easeHop = 1 - (1 - tHop) ** 3;
          extraLateral = o.fleeDir * HONK.FLEE_LATERAL_M * easeHop;
          hopY = Math.sin(tHop * Math.PI) * 0.8;
          if (elapsed > HONK.FLEE_DURATION_S) {
            const fall = elapsed - HONK.FLEE_DURATION_S;
            extraLateral += o.fleeDir * fall * 6;
            hopY -= fall * fall * 9;
            tumble = fall * 8;
          }
        }
        if (o.type === 'critter') {
          const rightX = Math.cos(world.heading),
            rightZ = -Math.sin(world.heading);
          x += rightX * extraLateral;
          const cz = world.z + rightZ * extraLateral;
          const kind = o.critter ?? 'cow';
          const i = critterCounters[kind];
          const pool = refs.critterPools.current.slots[kind];
          if (i >= pool.length) continue;
          const slot = pool[i] as THREE.Object3D;
          slot.position.set(x, y + hopY, cz);
          const heading = world.heading + (o.fleeStartedAt ? (Math.PI / 2) * (o.fleeDir ?? 1) : 0);
          slot.rotation.set(
            tumble,
            heading + Math.sin(now * 3 + o.swingPhase) * 0.08,
            tumble * 0.6,
          );
          critterCounters[kind]++;
          counters.critter++;
          continue;
        }
        const slots =
          o.type === 'barrier'
            ? refs.barrierSlots.current
            : o.type === 'cones'
              ? refs.conesSlots.current
              : o.type === 'gate'
                ? refs.gateSlots.current
                : o.type === 'hammer'
                  ? refs.hammerSlots.current
                  : refs.oilSlots.current;
        const i = counters[o.type as ObstacleType];
        if (i >= slots.length) continue;
        const slot = slots[i] as THREE.Object3D;
        slot.position.set(x, y, world.z);
        slot.rotation.set(0, world.heading, 0);
        if (o.type === 'hammer') slot.rotation.z = Math.sin(now * 2 + o.swingPhase) * 0.3;
        counters[o.type as ObstacleType]++;
      }
    }

    // Hide unused slots
    for (const [kind, slots] of [
      ['barrier', refs.barrierSlots.current],
      ['cones', refs.conesSlots.current],
      ['gate', refs.gateSlots.current],
      ['hammer', refs.hammerSlots.current],
      ['oil', refs.oilSlots.current],
    ] as const) {
      const used = counters[kind];
      for (let i = used; i < slots.length; i++) {
        const sl = slots[i];
        if (sl) sl.position.set(0, -9999, 0);
      }
    }
    for (const kind of ['cow', 'horse', 'llama', 'pig'] as CritterKind[]) {
      const pool = refs.critterPools.current.slots[kind];
      const used = critterCounters[kind];
      for (let i = used; i < pool.length; i++) {
        const sl = pool[i];
        if (sl) sl.position.set(0, -9999, 0);
      }
    }

    // Collision + near-miss + pickup detection
    const playerLat = s.lateral;
    const laneHalfWidth = TRACK.LANE_WIDTH / 2;
    if (plan) {
      const playerD = s.distance;
      const toCrash: { idx: number; type: ObstacleType }[] = [];
      for (let idx = 0; idx < plan.obstacles.length; idx++) {
        const o = plan.obstacles[idx];
        if (!o || Math.abs(o.d - playerD) > NEAR_MISS_DIST) continue;
        if (refs.planCrashedIdx.current.has(idx)) continue;
        if (o.type === 'critter' && refs.planFleeState.current.has(idx)) continue;
        const obsLat = laneCenterX(o.lane);
        const latDist = Math.abs(obsLat - playerLat);
        if (latDist <= laneHalfWidth) {
          toCrash.push({ idx, type: o.type });
        } else if (
          latDist <= laneHalfWidth + NEAR_MISS_LATERAL &&
          o.d < playerD &&
          !refs.nearMissFiredIds.current.has(idx)
        ) {
          refs.nearMissFiredIds.current.add(idx);
          combo.registerEvent('near-miss');
        }
      }
      for (const { idx, type } of toCrash) {
        combo.registerHit();
        refs.nearMissFiredIds.current.delete(idx);
        refs.planCrashedIdx.current.add(idx);
        const heavy = type === 'barrier' || type === 'hammer';
        useGameStore.getState().applyCrash(heavy);
        audioBus.playCrash();
        if (type === 'oil')
          useGameStore.getState().setLateral(playerLat + (eventsRng().next() - 0.5) * 4);
      }
      for (let idx = 0; idx < plan.pickups.length; idx++) {
        const p = plan.pickups[idx];
        if (!p || refs.planCrashedIdx.current.has(-idx - 1)) continue;
        if (Math.abs(p.d - playerD) > 3) continue;
        const plat = laneCenterX(p.lane);
        if (Math.abs(plat - playerLat) > laneHalfWidth) continue;
        refs.planCrashedIdx.current.add(-idx - 1);
        combo.registerEvent('pickup');
        // Route all pickup rewards through applyPickup — it owns the reward
        // formula. A prior double-award (direct setState + applyPickup) for
        // tickets has been removed; applyPickup handles crowdReaction.
        useGameStore.getState().applyPickup(p.type);
        audioBus.playPickup(p.type);
      }
    } else {
      const list = refs.spawner.getObstacles();
      const toRecycle: { o: (typeof list)[number]; heavy: boolean; oil: boolean }[] = [];
      for (const o of list) {
        if (Math.abs(o.d - s.distance) > NEAR_MISS_DIST) continue;
        if (o.type === 'critter' && o.fleeStartedAt) continue;
        const obsLat = laneCenterX(o.lane);
        const latDist = Math.abs(obsLat - playerLat);
        if (latDist <= laneHalfWidth) {
          toRecycle.push({
            o,
            heavy: o.type === 'barrier' || o.type === 'hammer',
            oil: o.type === 'oil',
          });
        } else if (
          latDist <= laneHalfWidth + NEAR_MISS_LATERAL &&
          o.d < s.distance &&
          !refs.nearMissFiredIds.current.has(o.id)
        ) {
          refs.nearMissFiredIds.current.add(o.id);
          combo.registerEvent('near-miss');
        }
      }
      for (const { o, heavy, oil } of toRecycle) {
        combo.registerHit();
        refs.nearMissFiredIds.current.delete(o.id);
        useGameStore.getState().applyCrash(heavy);
        audioBus.playCrash();
        if (oil) useGameStore.getState().setLateral(playerLat + (eventsRng().next() - 0.5) * 4);
        o.d = s.distance - 1000;
      }
      for (const p of refs.spawner.getPickups()) {
        if (p.consumed || Math.abs(p.d - s.distance) > 3) continue;
        const plat = laneCenterX(p.lane);
        if (Math.abs(plat - playerLat) > laneHalfWidth) continue;
        refs.spawner.consumePickup(p.id);
        combo.registerEvent('pickup');
        // Route all pickup rewards through applyPickup — it owns the reward
        // formula. A prior double-award (direct setState + applyPickup) for
        // tickets has been removed; applyPickup handles crowdReaction.
        useGameStore.getState().applyPickup(p.type);
        audioBus.playPickup(p.type);
      }
    }
  });
}
