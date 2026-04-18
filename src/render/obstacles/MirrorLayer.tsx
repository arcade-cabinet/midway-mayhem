/**
 * MirrorLayer — Feature A (Funhouse Frenzy zone gimmick).
 *
 * Pre-baked mirror rooms from `state.plan.mirrorRooms`: each room has a
 * list of phantom lanes that flicker on a square wave (period/phase baked
 * from the track RNG). Collision only applies to real obstacles (handled
 * by ObstacleSystem). When no run plan exists the legacy
 * `window.__mmMirrorDuplicator` is used so isolated unit tests keep
 * working.
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
// TODO(gameState): useGameStore from the in-flight gameState port
import { useGameStore } from '@/game/gameState';
import { composeTrack, DEFAULT_TRACK } from '@/track/trackComposer';
import { laneCenterX } from '@/utils/constants';
import { trackToWorld } from '@/game/obstacles/trackToWorld';

const MAX_MIRROR_COPIES = 24;
/** Render mirror rooms within this forward window (metres). */
const FORWARD_RENDER_M = 250;
const BEHIND_RENDER_M = 20;

const MIRROR_GEO = new THREE.BoxGeometry(1.2, 1.5, 0.6);
const MIRROR_MAT = new THREE.MeshStandardMaterial({
  color: '#8e24aa',
  emissive: '#1e88e5',
  emissiveIntensity: 0.8,
  roughness: 0.4,
  transparent: true,
  opacity: 0.85,
});

/** Compute square-wave opacity given a flicker period + phase offset. */
function flickerOpacity(nowS: number, period: number, phase: number): number {
  const p = (nowS / period + phase) % 1;
  return p < 0.5 ? 0.85 : 0.0;
}

export function MirrorLayer() {
  const groupRef = useRef<THREE.Group>(null);
  const mirrorSlots = useRef<THREE.Mesh[]>([]);
  const composition = useMemo(() => composeTrack(DEFAULT_TRACK, 10), []);

  useFrame(() => {
    const g = groupRef.current;
    if (!g || mirrorSlots.current.length > 0) return;
    for (let i = 0; i < MAX_MIRROR_COPIES; i++) {
      const mat = MIRROR_MAT.clone() as THREE.MeshStandardMaterial;
      mat.transparent = true;
      const mesh = new THREE.Mesh(MIRROR_GEO, mat);
      mesh.position.set(0, -9999, 0);
      g.add(mesh);
      mirrorSlots.current.push(mesh);
    }
  });

  useFrame(({ clock }) => {
    const s = useGameStore.getState();
    const plan = s.plan;

    if (!s.running || s.currentZone !== 'funhouse-frenzy') {
      for (const sl of mirrorSlots.current) {
        sl.position.set(0, -9999, 0);
      }
      // biome-ignore lint/suspicious/noExplicitAny: diagnostics
      (window as any).__mmDiag_mirrors = 0;
      return;
    }

    const nowSec = clock.elapsedTime;
    let slot = 0;

    if (plan) {
      const playerD = s.distance;
      const minD = playerD - BEHIND_RENDER_M;
      const maxD = playerD + FORWARD_RENDER_M;
      for (const room of plan.mirrorRooms) {
        if (room.d < minD || room.d > maxD) continue;
        for (const lane of room.phantomLanes) {
          if (slot >= MAX_MIRROR_COPIES) break;
          const opacity = flickerOpacity(nowSec, room.flickerPeriod, room.flickerPhase);
          const mesh = mirrorSlots.current[slot];
          if (!mesh) continue;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.opacity = opacity;
          mat.visible = opacity > 0.01;

          const lat = laneCenterX(lane);
          const world = trackToWorld(composition, room.d, lat);
          mesh.position.set(world.x, world.y + 0.75, world.z);
          mesh.rotation.set(0, world.heading, 0);
          slot++;
        }
        if (slot >= MAX_MIRROR_COPIES) break;
      }
    } else {
      // biome-ignore lint/suspicious/noExplicitAny: gimmick
      const mirrorDuplicator = (window as any).__mmMirrorDuplicator;
      if (!mirrorDuplicator) {
        for (const sl of mirrorSlots.current) sl.position.set(0, -9999, 0);
        // biome-ignore lint/suspicious/noExplicitAny: diagnostics
        (window as any).__mmDiag_mirrors = 0;
        return;
      }

      const entries = mirrorDuplicator.getEntries() as Array<{
        realObstacleId: number;
        realLane: number;
        realD: number;
        copies: Array<{
          lane: number;
          flickerPeriod: number;
          flickerPhase: number;
        }>;
      }>;

      for (const entry of entries) {
        for (const copy of entry.copies) {
          if (slot >= MAX_MIRROR_COPIES) break;
          const opacity = mirrorDuplicator.copyOpacity(copy, nowSec) as number;
          const mesh = mirrorSlots.current[slot];
          if (!mesh) continue;
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.opacity = opacity;
          mat.visible = opacity > 0.01;

          const lat = laneCenterX(copy.lane);
          const world = trackToWorld(composition, entry.realD, lat);
          mesh.position.set(world.x, world.y + 0.75, world.z);
          mesh.rotation.set(0, world.heading, 0);
          slot++;
        }
      }
    }

    // Hide unused
    for (let i = slot; i < mirrorSlots.current.length; i++) {
      const sl = mirrorSlots.current[i];
      if (sl) sl.position.set(0, -9999, 0);
    }

    // biome-ignore lint/suspicious/noExplicitAny: diagnostics
    (window as any).__mmDiag_mirrors = slot;
  });

  return <group ref={groupRef} data-testid="mirror-layer" />;
}
