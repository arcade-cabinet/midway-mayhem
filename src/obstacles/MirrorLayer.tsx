/**
 * MirrorLayer — Feature A (Funhouse Frenzy zone gimmick).
 *
 * Renders mirror copies of obstacles at offset lanes. Mirrors flicker;
 * real obstacles are steady. Collision only applies to real obstacles
 * (handled by ObstacleSystem as normal).
 */

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { composeTrack, DEFAULT_TRACK } from '@/track/trackComposer';
import { useGameStore } from '@/game/gameState';
import { laneCenterX } from '@/utils/constants';
import { trackToWorld } from './ObstacleSystem';

const MAX_MIRROR_COPIES = 24;

const MIRROR_GEO = new THREE.BoxGeometry(1.2, 1.5, 0.6);
const MIRROR_MAT = new THREE.MeshStandardMaterial({
  color: '#8e24aa',
  emissive: '#1e88e5',
  emissiveIntensity: 0.8,
  roughness: 0.4,
  transparent: true,
  opacity: 0.85,
});

export function MirrorLayer() {
  const groupRef = useRef<THREE.Group>(null);
  const mirrorSlots = useRef<THREE.Mesh[]>([]);
  const composition = useMemo(() => composeTrack(DEFAULT_TRACK, 10), []);

  useFrame(() => {
    const g = groupRef.current;
    if (!g || mirrorSlots.current.length > 0) return;
    for (let i = 0; i < MAX_MIRROR_COPIES; i++) {
      const mat = (MIRROR_MAT.clone() as THREE.MeshStandardMaterial);
      mat.transparent = true;
      const mesh = new THREE.Mesh(MIRROR_GEO, mat);
      mesh.position.set(0, -9999, 0);
      g.add(mesh);
      mirrorSlots.current.push(mesh);
    }
  });

  useFrame(({ clock }) => {
    const s = useGameStore.getState();
    if (!s.running || s.currentZone !== 'funhouse-frenzy') {
      // Hide all when not in zone
      for (const sl of mirrorSlots.current) {
        sl.position.set(0, -9999, 0);
      }
      return;
    }
    // biome-ignore lint/suspicious/noExplicitAny: gimmick
    const mirrorDuplicator = (window as any).__mmMirrorDuplicator;
    if (!mirrorDuplicator) return;

    const nowSec = clock.elapsedTime;
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

    let slot = 0;
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
