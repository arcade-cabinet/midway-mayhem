import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { assetUrl } from '@/assets/manifest';
import { audioBus } from '@/audio/audioBus';
import { onHonk } from '@/audio/honkBus';
import { combo } from '@/game/comboSystem';
import { reportCounts } from '@/game/diagnosticsBus';
import { reportError } from '@/game/errorBus';
import { useGameStore } from '@/game/gameState';
import { eventsRng } from '@/game/runRngBus';
import { ObstacleSpawner } from '@/obstacles/obstacleSpawner';
import { composeTrack, DEFAULT_TRACK, type PiecePlacement } from '@/track/trackComposer';
import type { CritterKind, ObstacleType } from '@/utils/constants';
import { HONK, laneCenterX, TRACK } from '@/utils/constants';

/**
 * Obstacles rendered via Kenney Racing Kit GLBs (baked with brand palette).
 * - barrier → barrierRed.glb
 * - cones   → cone.glb
 * - gate    → pylon.glb (a flag gate) or two barrierWhite flanking — using pylon pair for now
 * - oil     → custom flat dark disk (no Kenney equivalent)
 * - hammer  → barrierWall.glb rotated — imposing slab that swings
 *
 * When a pre-baked RunPlan is available (the common case) the system
 * renders plan entries directly. The RunPlan is computed once at
 * startRun() and enumerates every obstacle for the entire track, letting
 * critters play their idle animations long before the player arrives.
 * The legacy streaming ObstacleSpawner path is retained as a fallback for
 * unit tests / diagnostics that instantiate the layer without a run.
 */

const MAX_PER_TYPE = 40;
/** Render plan entries within this forward window (metres). */
const FORWARD_RENDER_M = 500;
/** Render plan entries within this behind window (metres). */
const BEHIND_RENDER_M = 40;

/** Mutable flee state keyed by plan-entry index. */
interface PlanFleeState {
  fleeStartedAt: number;
  fleeDir: -1 | 1;
}

export function ObstacleSystem() {
  const seed = useGameStore((s) => s.seed);
  // Rebuild the spawner when seed changes (new run). It pulls from the
  // shared events RNG so every in-run streaming source advances one PRNG.
  // Only used in the fallback path when no RunPlan exists (tests, diagnostics).
  // biome-ignore lint/correctness/useExhaustiveDependencies: rebuild on seed change
  const spawner = useMemo(() => new ObstacleSpawner(eventsRng()), [seed]);
  const composition = useMemo(() => composeTrack(DEFAULT_TRACK, 10), []);

  // Load all obstacle GLBs (preloaded already via manifest HEAD probe)
  const barrierGltf = useGLTF(assetUrl('gltf:barrierRed')) as unknown as {
    scene: THREE.Object3D;
  };
  const coneGltf = useGLTF(assetUrl('gltf:cone')) as unknown as { scene: THREE.Object3D };
  const pylonGltf = useGLTF(assetUrl('gltf:pylon')) as unknown as { scene: THREE.Object3D };
  const wallGltf = useGLTF(assetUrl('gltf:barrierWall')) as unknown as {
    scene: THREE.Object3D;
  };
  const cowGltf = useGLTF(assetUrl('gltf:critter_cow')) as unknown as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };
  const horseGltf = useGLTF(assetUrl('gltf:critter_horse')) as unknown as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };
  const llamaGltf = useGLTF(assetUrl('gltf:critter_llama')) as unknown as {
    scene: THREE.Object3D;
    animations: THREE.AnimationClip[];
  };
  const pigGltf = useGLTF(assetUrl('gltf:critter_pig')) as unknown as {
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

  // Obstacle-group refs (one group per slot)
  const barrierGroupRef = useRef<THREE.Group>(null);
  const conesGroupRef = useRef<THREE.Group>(null);
  const gateGroupRef = useRef<THREE.Group>(null);
  const hammerGroupRef = useRef<THREE.Group>(null);
  const oilGroupRef = useRef<THREE.Group>(null);
  const critterGroupRef = useRef<THREE.Group>(null);

  /** Obstacle ids already counted as near-miss — prevents double-counting. */
  const nearMissFiredIds = useRef<Set<number>>(new Set());
  /** Flee state keyed by plan-entry index (plan path only). */
  const planFleeState = useRef<Map<number, PlanFleeState>>(new Map());
  /** Plan-entry indices that the player has already collided with this run. */
  const planCrashedIdx = useRef<Set<number>>(new Set());

  // Pool of clone-refs per type
  const barrierSlots = useRef<THREE.Object3D[]>([]);
  const conesSlots = useRef<THREE.Object3D[]>([]);
  const gateSlots = useRef<THREE.Object3D[]>([]);
  const hammerSlots = useRef<THREE.Object3D[]>([]);
  const oilSlots = useRef<THREE.Mesh[]>([]);
  /** One pool per critter kind — 10 slots each, rotated in by spawn order. */
  const critterSlots = useRef<Record<CritterKind, THREE.Object3D[]>>({
    cow: [],
    horse: [],
    llama: [],
    pig: [],
  });
  /**
   * Per-slot AnimationMixer. Each critter clone has its own mixer playing
   * the idle clip at an offset phase so animals don't breathe in sync.
   */
  const critterMixers = useRef<Record<CritterKind, THREE.AnimationMixer[]>>({
    cow: [],
    horse: [],
    llama: [],
    pig: [],
  });

  const oilGeo = useMemo(() => new THREE.CylinderGeometry(1.6, 1.6, 0.08, 24), []);
  const oilMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#0a0410', roughness: 0.3, metalness: 0.0 }),
    [],
  );

  useEffect(() => {
    // biome-ignore lint/suspicious/noExplicitAny: diagnostics
    (window as any).__mmSpawner = spawner;
  }, [spawner]);

  // Wire honk → scare nearby critters. Honk frightens any idling critter
  // within SCARE_RADIUS_M ahead of the player; in the plan path we flip
  // the per-index flee state map. Fallback spawner path uses its own scare.
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
        useGameStore.setState((prev) => ({
          crowdReaction: prev.crowdReaction + scared * 10 * mult,
        }));
      }
    });
  }, [spawner]);

  // Pre-populate pools on first frame.
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

    // Critter pool — 10 slots per kind (cow/horse/llama/pig). Each clone
    // gets its own AnimationMixer with the first animation clip baked from
    // the GLB; we offset start time by `idlePhase` so the herd isn't in
    // lockstep. Hard-fail (reportError) if a critter clip is missing — the
    // baked assets must ship with idle animations.
    for (const kind of ['cow', 'horse', 'llama', 'pig'] as CritterKind[]) {
      if (critterSlots.current[kind].length > 0) continue;
      const clips = critterAnimations[kind];
      const clip = pickIdleClip(clips);
      if (!clip) {
        reportError(
          new Error(`Critter GLB '${kind}' has no idle animation clip`),
          'ObstacleSystem.critterSetup',
        );
      }
      for (let i = 0; i < 10; i++) {
        const c = critterScenes[kind].clone(true);
        // Farm animal GLBs ship at real-world scale (~1m) — scale up to match
        // the oversized-arcade proportions of the Kenney track (scale=10).
        c.scale.setScalar(3.5);
        c.position.set(0, -9999, 0);
        critterGroupRef.current?.add(c);
        critterSlots.current[kind].push(c);

        const mixer = new THREE.AnimationMixer(c);
        if (clip) {
          const action = mixer.clipAction(clip);
          action.loop = THREE.LoopRepeat;
          action.play();
          // Per-slot idle phase offset is assigned when the slot is bound to
          // a plan entry each frame; initialize to a staggered default now
          // so animals look alive even before the first plan bind.
          mixer.setTime((i * 0.37) % Math.max(clip.duration, 0.1));
        }
        critterMixers.current[kind].push(mixer);
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

  useFrame((_state, dt) => {
    const s = useGameStore.getState();
    if (!s.running) return;
    const plan = s.plan;
    const nowMs = performance.now();
    const now = nowMs * 0.001;

    const counters = { barrier: 0, cones: 0, gate: 0, hammer: 0, oil: 0, critter: 0 };
    const critterCounters: Record<CritterKind, number> = { cow: 0, horse: 0, llama: 0, pig: 0 };

    // Tick every critter mixer every frame — silent slots keep their idle
    // clip advancing so the pose stays alive when the pool rotates them in.
    for (const kind of ['cow', 'horse', 'llama', 'pig'] as CritterKind[]) {
      for (const mx of critterMixers.current[kind]) mx.update(dt);
    }

    if (plan) {
      // ── PLAN PATH: render pre-baked entries within render window ────────
      const playerD = s.distance;
      const minD = playerD - BEHIND_RENDER_M;
      const maxD = playerD + FORWARD_RENDER_M;

      for (let idx = 0; idx < plan.obstacles.length; idx++) {
        const o = plan.obstacles[idx];
        if (!o) continue;
        if (o.d < minD || o.d > maxD) continue;

        const world = trackToWorld(composition, o.d, laneCenterX(o.lane));
        const y = world.y + 0.1;
        let x = world.x;
        if (o.type === 'hammer') x += Math.sin(now * 2 + o.yaw) * 3;

        // Flee animation: identical arc to spawner path but driven by the
        // per-index flee map populated by the honk handler.
        let extraLateral = 0;
        let hopY = 0;
        let tumble = 0;
        const flee = o.type === 'critter' ? planFleeState.current.get(idx) : undefined;
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
          const rightX = Math.cos(world.heading);
          const rightZ = -Math.sin(world.heading);
          x += rightX * extraLateral;
          const cz = world.z + rightZ * extraLateral;

          const kind = o.critter ?? 'cow';
          const pool = critterSlots.current[kind];
          const slotIdx = critterCounters[kind];
          if (slotIdx >= pool.length) continue;
          const slot = pool[slotIdx] as THREE.Object3D;
          slot.position.set(x, y + hopY, cz);
          const heading = world.heading + (flee ? (Math.PI / 2) * flee.fleeDir : 0);
          slot.rotation.set(tumble, heading + Math.sin(now * 3 + o.yaw) * 0.08, tumble * 0.6);

          // When this pool slot takes over a new plan entry, seed the
          // mixer's time to the entry's baked `idlePhase` so each critter
          // breathes at its own offset. Sentinel on the slot prevents
          // re-seeding every frame (which would freeze the pose).
          const mixer = critterMixers.current[kind][slotIdx];
          // biome-ignore lint/suspicious/noExplicitAny: sentinel attachment
          const slotAny = slot as any;
          if (mixer && slotAny.__mmPhasedForIdx !== idx) {
            const clip = pickIdleClip(critterAnimations[kind]);
            if (clip) {
              mixer.setTime(o.idlePhase % Math.max(clip.duration, 0.1));
            }
            slotAny.__mmPhasedForIdx = idx;
          }

          critterCounters[kind]++;
          counters.critter++;
          continue;
        }

        const slots =
          o.type === 'barrier'
            ? barrierSlots.current
            : o.type === 'cones'
              ? conesSlots.current
              : o.type === 'gate'
                ? gateSlots.current
                : o.type === 'hammer'
                  ? hammerSlots.current
                  : oilSlots.current;

        const i = counters[o.type];
        if (i >= slots.length) continue;
        const slot = slots[i] as THREE.Object3D;
        slot.position.set(x, y, world.z);
        slot.rotation.set(0, world.heading + o.yaw, 0);
        if (o.type === 'hammer') {
          slot.rotation.z = Math.sin(now * 2 + o.yaw) * 0.3;
        }
        counters[o.type]++;
      }
    } else {
      // ── FALLBACK PATH: legacy streaming spawner (unit tests, diagnostics)
      spawner.update(s.distance, s.currentZone);
      const list = spawner.getObstacles();

      for (const o of list) {
        const world = trackToWorld(composition, o.d, laneCenterX(o.lane));
        const y = world.y + 0.1;
        let x = world.x;
        if (o.type === 'hammer') x += Math.sin(now * 2 + o.swingPhase) * 3;

        let extraLateral = 0;
        let hopY = 0;
        let tumble = 0;
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
          const rightX = Math.cos(world.heading);
          const rightZ = -Math.sin(world.heading);
          x += rightX * extraLateral;
          const cz = world.z + rightZ * extraLateral;

          const kind = o.critter ?? 'cow';
          const i = critterCounters[kind];
          const pool = critterSlots.current[kind];
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
            ? barrierSlots.current
            : o.type === 'cones'
              ? conesSlots.current
              : o.type === 'gate'
                ? gateSlots.current
                : o.type === 'hammer'
                  ? hammerSlots.current
                  : oilSlots.current;

        const i = counters[o.type as ObstacleType];
        if (i >= slots.length) continue;
        const slot = slots[i] as THREE.Object3D;
        slot.position.set(x, y, world.z);
        slot.rotation.set(0, world.heading, 0);
        if (o.type === 'hammer') {
          slot.rotation.z = Math.sin(now * 2 + o.swingPhase) * 0.3;
        }
        counters[o.type as ObstacleType]++;
      }
    }

    // Hide unused slots (including per-kind critter pools)
    for (const [kind, slots] of [
      ['barrier', barrierSlots.current],
      ['cones', conesSlots.current],
      ['gate', gateSlots.current],
      ['hammer', hammerSlots.current],
      ['oil', oilSlots.current],
    ] as const) {
      const used = counters[kind];
      for (let i = used; i < slots.length; i++) {
        const sl = slots[i];
        if (sl) sl.position.set(0, -9999, 0);
      }
    }
    for (const kind of ['cow', 'horse', 'llama', 'pig'] as CritterKind[]) {
      const pool = critterSlots.current[kind];
      const used = critterCounters[kind];
      for (let i = used; i < pool.length; i++) {
        const sl = pool[i];
        if (sl) sl.position.set(0, -9999, 0);
      }
    }

    // Collision & near-miss: route through plan when available.
    const playerLat = s.lateral;
    const laneHalfWidth = TRACK.LANE_WIDTH / 2;
    const NEAR_MISS_LATERAL = 0.7;
    const NEAR_MISS_DIST = 3;

    if (plan) {
      const playerD = s.distance;
      const toCrash: { idx: number; type: ObstacleType }[] = [];
      for (let idx = 0; idx < plan.obstacles.length; idx++) {
        const o = plan.obstacles[idx];
        if (!o) continue;
        if (Math.abs(o.d - playerD) > NEAR_MISS_DIST) continue;
        if (planCrashedIdx.current.has(idx)) continue;
        if (o.type === 'critter' && planFleeState.current.has(idx)) continue;
        const obsLat = laneCenterX(o.lane);
        const latDist = Math.abs(obsLat - playerLat);
        if (latDist <= laneHalfWidth) {
          toCrash.push({ idx, type: o.type });
        } else if (
          latDist <= laneHalfWidth + NEAR_MISS_LATERAL &&
          o.d < playerD &&
          !nearMissFiredIds.current.has(idx)
        ) {
          nearMissFiredIds.current.add(idx);
          combo.registerEvent('near-miss');
        }
      }
      for (const { idx, type } of toCrash) {
        combo.registerHit();
        nearMissFiredIds.current.delete(idx);
        planCrashedIdx.current.add(idx);
        const heavy = type === 'barrier' || type === 'hammer';
        useGameStore.getState().applyCrash(heavy);
        audioBus.playCrash();
        if (type === 'oil') {
          useGameStore.getState().setLateral(playerLat + (eventsRng().next() - 0.5) * 4);
        }
      }

      // Pickups: lightweight lane-hit check. Pickups consumed per plan index.
      for (let idx = 0; idx < plan.pickups.length; idx++) {
        const p = plan.pickups[idx];
        if (!p) continue;
        if (planCrashedIdx.current.has(-idx - 1)) continue; // sentinel: negative keys for pickups
        if (Math.abs(p.d - playerD) > 3) continue;
        const plat = laneCenterX(p.lane);
        if (Math.abs(plat - playerLat) > laneHalfWidth) continue;
        planCrashedIdx.current.add(-idx - 1);
        combo.registerEvent('pickup');
        const mult = combo.getMultiplier();
        if (p.type === 'ticket') {
          useGameStore.setState((prev) => ({ crowdReaction: prev.crowdReaction + 50 * mult }));
          useGameStore.getState().applyPickup(p.type);
        } else {
          useGameStore.getState().applyPickup(p.type);
        }
        audioBus.playPickup(p.type);
      }

      reportCounts(plan.obstacles.length, plan.pickups.length, 0);
    } else {
      const list = spawner.getObstacles();
      const toRecycle: { o: (typeof list)[number]; heavy: boolean; oil: boolean }[] = [];
      for (const o of list) {
        if (Math.abs(o.d - s.distance) > NEAR_MISS_DIST) continue;
        if (o.type === 'critter' && o.fleeStartedAt) continue;
        const obsLat = laneCenterX(o.lane);
        const latDist = Math.abs(obsLat - playerLat);
        if (latDist <= laneHalfWidth) {
          const heavy = o.type === 'barrier' || o.type === 'hammer';
          toRecycle.push({ o, heavy, oil: o.type === 'oil' });
        } else if (
          latDist <= laneHalfWidth + NEAR_MISS_LATERAL &&
          o.d < s.distance &&
          !nearMissFiredIds.current.has(o.id)
        ) {
          nearMissFiredIds.current.add(o.id);
          combo.registerEvent('near-miss');
        }
      }
      for (const { o, heavy, oil } of toRecycle) {
        combo.registerHit();
        nearMissFiredIds.current.delete(o.id);
        useGameStore.getState().applyCrash(heavy);
        audioBus.playCrash();
        if (oil) {
          useGameStore.getState().setLateral(playerLat + (eventsRng().next() - 0.5) * 4);
        }
        o.d = s.distance - 1000;
      }
      for (const p of spawner.getPickups()) {
        if (p.consumed) continue;
        if (Math.abs(p.d - s.distance) > 3) continue;
        const plat = laneCenterX(p.lane);
        if (Math.abs(plat - playerLat) > laneHalfWidth) continue;
        spawner.consumePickup(p.id);
        combo.registerEvent('pickup');
        const mult = combo.getMultiplier();
        if (p.type === 'ticket') {
          useGameStore.setState((prev) => ({ crowdReaction: prev.crowdReaction + 50 * mult }));
          useGameStore.getState().applyPickup(p.type);
        } else {
          useGameStore.getState().applyPickup(p.type);
        }
        audioBus.playPickup(p.type);
      }

      reportCounts(list.length, spawner.getPickups().length, 0);
    }
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

/**
 * Pick the idle animation clip from a GLB's animations array. Prefers a
 * clip whose name contains "idle" (case-insensitive); falls back to the
 * first clip since every critter GLB in this project ships with exactly
 * one looping idle clip.
 */
function pickIdleClip(clips: THREE.AnimationClip[]): THREE.AnimationClip | null {
  if (clips.length === 0) return null;
  const idle = clips.find((c) => /idle/i.test(c.name));
  return idle ?? clips[0] ?? null;
}

// ── Re-export: legacy world-transform used by peer obstacle layers ─────────
//
// BalloonLayer / FireHoopGate / MirrorLayer / PickupSystem all import
// trackToWorld from this module. We still export the same signature so
// those layers' imports keep resolving.
export function trackToWorld(
  composition: ReturnType<typeof composeTrack>,
  d: number,
  lateral: number,
): { x: number; y: number; z: number; heading: number } {
  let placement: PiecePlacement | undefined;
  for (const p of composition.placements) {
    if (d >= p.distanceAtStart && d < p.distanceAtStart + p.length) {
      placement = p;
      break;
    }
  }
  if (!placement) {
    placement = composition.placements[composition.placements.length - 1];
    if (!placement) return { x: 0, y: 0, z: 0, heading: 0 };
  }

  const offsetIntoPiece = d - placement.distanceAtStart;
  const h = placement.rotationY;
  const forwardX = -Math.sin(h);
  const forwardZ = -Math.cos(h);
  const latX = Math.cos(h);
  const latZ = -Math.sin(h);

  const anchorFwd = 0.65 * 10;
  const anchorRight = 0.15 * 10;
  const seamWorldX = placement.position[0] + forwardX * anchorFwd + latX * anchorRight;
  const seamWorldZ = placement.position[2] + forwardZ * anchorFwd + latZ * anchorRight;

  return {
    x: seamWorldX + forwardX * offsetIntoPiece + latX * lateral,
    y: placement.position[1],
    z: seamWorldZ + forwardZ * offsetIntoPiece + latZ * lateral,
    heading: h,
  };
}
