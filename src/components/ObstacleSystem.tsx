import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { assetUrl } from '../assets/manifest';
import { composeTrack, DEFAULT_TRACK, type PiecePlacement } from '../game/trackComposer';
import { audioBus } from '../systems/audioBus';
import { reportCounts } from '../systems/diagnosticsBus';
import { useGameStore } from '../systems/gameState';
import { onHonk } from '../systems/honkBus';
import { ObstacleSpawner } from '../systems/obstacleSpawner';
import type { CritterKind } from '../utils/constants';
import { HONK, laneCenterX, TRACK } from '../utils/constants';
import { createRng } from '../utils/rng';

/**
 * Obstacles rendered via Kenney Racing Kit GLBs (baked with brand palette).
 * - barrier → barrierRed.glb
 * - cones   → cone.glb
 * - gate    → pylon.glb (a flag gate) or two barrierWhite flanking — using pylon pair for now
 * - oil     → custom flat dark disk (no Kenney equivalent)
 * - hammer  → barrierWall.glb rotated — imposing slab that swings
 */

const MAX_PER_TYPE = 40;

export function ObstacleSystem() {
  const seed = useGameStore((s) => s.seed);
  const spawner = useMemo(() => new ObstacleSpawner(createRng(seed || 1)), [seed]);
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
  const cowGltf = useGLTF(assetUrl('gltf:critter_cow')) as unknown as { scene: THREE.Object3D };
  const horseGltf = useGLTF(assetUrl('gltf:critter_horse')) as unknown as {
    scene: THREE.Object3D;
  };
  const llamaGltf = useGLTF(assetUrl('gltf:critter_llama')) as unknown as {
    scene: THREE.Object3D;
  };
  const pigGltf = useGLTF(assetUrl('gltf:critter_pig')) as unknown as { scene: THREE.Object3D };
  const critterScenes: Record<CritterKind, THREE.Object3D> = {
    cow: cowGltf.scene,
    horse: horseGltf.scene,
    llama: llamaGltf.scene,
    pig: pigGltf.scene,
  };

  // Obstacle-group refs (one group per slot)
  const barrierGroupRef = useRef<THREE.Group>(null);
  const conesGroupRef = useRef<THREE.Group>(null);
  const gateGroupRef = useRef<THREE.Group>(null);
  const hammerGroupRef = useRef<THREE.Group>(null);
  const oilGroupRef = useRef<THREE.Group>(null);
  const critterGroupRef = useRef<THREE.Group>(null);

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

  const oilGeo = useMemo(() => new THREE.CylinderGeometry(1.6, 1.6, 0.08, 24), []);
  const oilMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#0a0410', roughness: 0.3, metalness: 0.0 }),
    [],
  );

  useEffect(() => {
    // biome-ignore lint/suspicious/noExplicitAny: diagnostics
    (window as any).__mmSpawner = spawner;
  }, [spawner]);

  // Wire honk → scare nearby critters
  useEffect(() => {
    return onHonk(() => {
      const s = useGameStore.getState();
      if (!s.running) return;
      const scared = spawner.scareCritters(s.distance, performance.now());
      if (scared > 0) {
        // Bonus crowd reaction per scared critter — rewards skillful honking
        useGameStore.setState((prev) => ({ crowdReaction: prev.crowdReaction + scared * 10 }));
      }
    });
  }, [spawner]);

  // Pre-populate pools on first frame
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

    // Critter pool — 10 slots per kind (cow/horse/llama/pig)
    for (const kind of ['cow', 'horse', 'llama', 'pig'] as CritterKind[]) {
      if (critterSlots.current[kind].length > 0) continue;
      for (let i = 0; i < 10; i++) {
        const c = critterScenes[kind].clone(true);
        // Farm animal GLBs ship at real-world scale (~1m) — scale up to match
        // the oversized-arcade proportions of the Kenney track (scale=10).
        c.scale.setScalar(3.5);
        c.position.set(0, -9999, 0);
        critterGroupRef.current?.add(c);
        critterSlots.current[kind].push(c);
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
  ]);

  useFrame(() => {
    const s = useGameStore.getState();
    if (!s.running) return;
    spawner.update(s.distance, s.currentZone);
    const list = spawner.getObstacles();
    const now = performance.now() * 0.001;

    const counters = { barrier: 0, cones: 0, gate: 0, hammer: 0, oil: 0, critter: 0 };
    const critterCounters: Record<CritterKind, number> = { cow: 0, horse: 0, llama: 0, pig: 0 };
    const nowMs = performance.now();

    for (const o of list) {
      const world = trackToWorld(composition, o.d, laneCenterX(o.lane));
      const y = world.y + 0.1;
      let x = world.x;
      if (o.type === 'hammer') x += Math.sin(now * 2 + o.swingPhase) * 3;

      // Critter flee animation: lateral hop up-and-off-the-track, then a
      // slapstick tumble off the edge. During phase 1 (0-1) they arc
      // sideways and up. During phase 2 (>1) they keep drifting laterally
      // while rotating + falling, selling the pratfall off the rails.
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
          // Pratfall: keep sliding outward and drop below the track plane
          const fall = elapsed - HONK.FLEE_DURATION_S;
          extraLateral += o.fleeDir * fall * 6; // slide out
          hopY -= fall * fall * 9; // gravity-ish drop
          tumble = fall * 8; // radians/sec tumble
        }
      }

      // For critters, apply extraLateral along the track-local right axis
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
        // Critters face along -forward (same heading as track) with a
        // slight wobble to feel alive; when fleeing, rotate to face flee
        // direction and apply a tumble around the track-right axis once
        // they've gone over the edge.
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

      const i = counters[o.type];
      if (i >= slots.length) continue;
      const slot = slots[i] as THREE.Object3D;
      slot.position.set(x, y, world.z);
      slot.rotation.set(0, world.heading, 0);
      if (o.type === 'hammer') {
        slot.rotation.z = Math.sin(now * 2 + o.swingPhase) * 0.3;
      }
      counters[o.type]++;
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

    // Collision: player lateral vs obstacle lane center. Fleeing critters
    // pass through harmlessly — that's the whole point of honking.
    const playerLat = s.lateral;
    const laneHalfWidth = TRACK.LANE_WIDTH / 2;
    for (const o of list) {
      if (Math.abs(o.d - s.distance) > 3) continue;
      if (o.type === 'critter' && o.fleeStartedAt) continue;
      const obsLat = laneCenterX(o.lane);
      if (Math.abs(obsLat - playerLat) > laneHalfWidth) continue;
      const heavy = o.type === 'barrier' || o.type === 'hammer';
      useGameStore.getState().applyCrash(heavy);
      audioBus.playCrash();
      if (o.type === 'oil') {
        useGameStore.getState().setLateral(playerLat + (Math.random() - 0.5) * 4);
      }
      o.d = s.distance - 1000;
    }
    for (const p of spawner.getPickups()) {
      if (p.consumed) continue;
      if (Math.abs(p.d - s.distance) > 3) continue;
      const plat = laneCenterX(p.lane);
      if (Math.abs(plat - playerLat) > laneHalfWidth) continue;
      spawner.consumePickup(p.id);
      useGameStore.getState().applyPickup(p.type);
      audioBus.playPickup(p.type);
    }

    reportCounts(list.length, spawner.getPickups().length, 0);
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

/** Given a track-centerline distance `d` and lateral offset, return world-space pose. */
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
