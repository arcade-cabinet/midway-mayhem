import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../systems/gameState';
import { reportCounts } from '../systems/diagnosticsBus';
import { audioBus } from '../systems/audioBus';
import { ObstacleSpawner } from '../systems/obstacleSpawner';
import { createRng } from '../utils/rng';
import { DEFAULT_TRACK, composeTrack, type PiecePlacement } from '../game/trackComposer';

/**
 * Obstacles placed at absolute track coordinates. The <WorldScroller>
 * parent translates them so the cockpit-at-origin sees them approach.
 *
 * Collision check uses player's abstract distance and lateral — we map
 * those to world X/Z via the composed-track cumulative distance.
 */

const MAX_OBSTACLES = 60;

export function ObstacleSystem() {
  const seed = useGameStore((s) => s.seed);
  const spawner = useMemo(() => new ObstacleSpawner(createRng(seed || 1)), [seed]);
  const composition = useMemo(() => composeTrack(DEFAULT_TRACK, 10), []);

  const barriersRef = useRef<THREE.InstancedMesh>(null);
  const conesRef = useRef<THREE.InstancedMesh>(null);
  const gatesRef = useRef<THREE.InstancedMesh>(null);
  const oilRef = useRef<THREE.InstancedMesh>(null);
  const hammerRef = useRef<THREE.InstancedMesh>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    // biome-ignore lint/suspicious/noExplicitAny: diagnostics
    (window as any).__mmSpawner = spawner;
  }, [spawner]);

  useFrame(() => {
    const s = useGameStore.getState();
    if (!s.running) return;
    spawner.update(s.distance, s.currentZone);
    const obstacles = spawner.getObstacles();
    const now = performance.now() * 0.001;

    const refs = {
      barrier: barriersRef.current,
      cones: conesRef.current,
      gate: gatesRef.current,
      oil: oilRef.current,
      hammer: hammerRef.current,
    } as const;

    const counts: Record<string, number> = { barrier: 0, cones: 0, gate: 0, oil: 0, hammer: 0 };

    for (const o of obstacles) {
      const m = refs[o.type];
      if (!m) continue;
      const i = counts[o.type] ?? 0;
      if (i >= m.count) continue;

      // Map the obstacle's (d, lane) onto world XYZ along the composed track
      const world = trackToWorld(composition, o.d, (o.lane - 1.5) * 1.3);
      const y = world.y + 1;
      let x = world.x;
      if (o.type === 'hammer') x += Math.sin(now * 2 + o.swingPhase) * 3;

      dummy.position.set(x, y, world.z);
      dummy.rotation.set(0, world.heading, 0);
      dummy.scale.set(1, 1, 1);
      if (o.type === 'gate') dummy.scale.set(4, 3, 0.3);
      if (o.type === 'oil') dummy.scale.set(2, 0.05, 2);
      if (o.type === 'hammer') dummy.scale.set(1.2, 3, 0.6);
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
      counts[o.type] = i + 1;
    }
    for (const t of ['barrier', 'cones', 'gate', 'oil', 'hammer'] as const) {
      const m = refs[t];
      if (!m) continue;
      for (let i = counts[t] ?? 0; i < m.count; i++) {
        dummy.position.set(0, -9999, 0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    }

    // Collision: player lateral vs obstacle lane
    const playerLat = s.lateral;
    for (const o of obstacles) {
      if (Math.abs(o.d - s.distance) > 3) continue;
      const obsLat = (o.lane - 1.5) * 3.0; // lane spacing in track lateral units
      if (Math.abs(obsLat - playerLat) > 2.0) continue;
      const heavy = o.type === 'barrier' || o.type === 'hammer';
      useGameStore.getState().applyCrash(heavy);
      audioBus.playCrash();
      if (o.type === 'oil') {
        useGameStore.getState().setLateral(playerLat + (Math.random() - 0.5) * 4);
      }
      o.d = s.distance - 1000; // move off-track
    }
    for (const p of spawner.getPickups()) {
      if (p.consumed) continue;
      if (Math.abs(p.d - s.distance) > 3) continue;
      const plat = (p.lane - 1.5) * 3.0;
      if (Math.abs(plat - playerLat) > 2.0) continue;
      spawner.consumePickup(p.id);
      useGameStore.getState().applyPickup(p.type);
      audioBus.playPickup(p.type);
    }

    reportCounts(obstacles.length, spawner.getPickups().length, 0);
  });

  const boxGeo = useMemo(() => new THREE.BoxGeometry(3, 1.5, 1), []);
  const coneGeo = useMemo(() => new THREE.ConeGeometry(0.6, 1.4, 6), []);
  const gateGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const oilGeo = useMemo(() => new THREE.CylinderGeometry(1, 1, 0.1, 20), []);
  const hammerGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);

  return (
    <group data-testid="obstacle-system">
      <instancedMesh ref={barriersRef} args={[boxGeo, undefined, MAX_OBSTACLES]}>
        <meshStandardMaterial color="#ffd600" emissive="#332200" />
      </instancedMesh>
      <instancedMesh ref={conesRef} args={[coneGeo, undefined, MAX_OBSTACLES]}>
        <meshStandardMaterial color="#F36F21" emissive="#331500" />
      </instancedMesh>
      <instancedMesh ref={gatesRef} args={[gateGeo, undefined, MAX_OBSTACLES]}>
        <meshStandardMaterial color="#1E88E5" emissive="#001133" />
      </instancedMesh>
      <instancedMesh ref={oilRef} args={[oilGeo, undefined, MAX_OBSTACLES]}>
        <meshBasicMaterial color="#0b0f1a" />
      </instancedMesh>
      <instancedMesh ref={hammerRef} args={[hammerGeo, undefined, MAX_OBSTACLES]}>
        <meshStandardMaterial color="#8E24AA" emissive="#220033" />
      </instancedMesh>
    </group>
  );
}

/**
 * Given a track-centerline distance `d` and a lateral offset in lane-units,
 * return world-space coordinates + heading.
 */
export function trackToWorld(
  composition: ReturnType<typeof composeTrack>,
  d: number,
  lateral: number,
): { x: number; y: number; z: number; heading: number } {
  // Find the placement whose distance range covers d
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
  // heading = placement.rotationY; move forward along -Z in local frame (that's track +Y in Kenney)
  const h = placement.rotationY;
  // Local forward direction after three rotation-Y:
  const forwardX = -Math.sin(h);
  const forwardZ = -Math.cos(h);
  // Lateral direction = right of forward (world +X of forward heading)
  const latX = Math.cos(h);
  const latZ = -Math.sin(h);

  // placement.position is the piece's local origin; the front seam is offset from that
  // by (local_anchor.x, local_anchor.y) scaled by 10 in the piece's local frame.
  const anchorFwd = 0.65 * 10;
  const anchorRight = 0.15 * 10;
  const seamWorldX = placement.position[0] + forwardX * anchorFwd + latX * anchorRight;
  const seamWorldZ = placement.position[2] + forwardZ * anchorFwd + latZ * anchorRight;

  const x = seamWorldX + forwardX * offsetIntoPiece + latX * lateral;
  const z = seamWorldZ + forwardZ * offsetIntoPiece + latZ * lateral;
  const y = placement.position[1];

  return { x, y, z, heading: h };
}
