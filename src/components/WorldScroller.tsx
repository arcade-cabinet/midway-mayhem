import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../systems/gameState';
import { STEER, TRACK } from '../utils/constants';
import { reportScene } from '../systems/diagnosticsBus';

/**
 * Translates the world opposite to the player's forward motion so that
 * the cockpit at world origin *appears* to race through the track.
 *
 * Forward axis is -Z. As distance increases, world translates +Z.
 * Lateral steer translates world on +X (opposite of car motion).
 */
export function WorldScroller({ children }: { children: ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const s = useGameStore.getState();
    const g = groupRef.current;
    if (!g) return;
    const playerLat = Math.max(-TRACK.LATERAL_CLAMP, Math.min(TRACK.LATERAL_CLAMP, s.lateral));
    g.position.set(-playerLat, -1.5, s.distance);

    // diagnostics: count track meshes actually under the scroller + camera pose
    let trackPieces = 0;
    let meshes = 0;
    // Find the named "track" group and count its immediate children (one group per piece)
    const trackGroup = g.getObjectByName('track');
    if (trackGroup) trackPieces = trackGroup.children.length;
    g.traverse((o) => {
      if (o.type === 'Mesh') meshes++;
    });
    // Expose per-piece world positions for targeted debugging
    // biome-ignore lint/suspicious/noExplicitAny: dev diagnostic
    const w = window as any;
    if (w.__mmDebug !== false) {
      w.__mmDebugTrack = trackGroup?.children.map((c, i) => ({
        index: i,
        worldPos: c.getWorldPosition(new THREE.Vector3()).toArray(),
        visible: c.visible,
      }));
    }
    const camPos = state.camera.getWorldPosition(new THREE.Vector3());
    reportScene({
      trackPieces,
      meshesRendered: meshes,
      cameraPos: [camPos.x, camPos.y, camPos.z],
      worldScrollerPos: [g.position.x, g.position.y, g.position.z],
    });
    void STEER;
  });

  return <group ref={groupRef}>{children}</group>;
}
