import { useFrame } from '@react-three/fiber';
import { type ReactNode, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { reportScene } from '@/game/diagnosticsBus';
import { useGameStore } from '@/game/gameState';
import { trackToWorld } from '@/obstacles/ObstacleSystem';
import { composeTrack, DEFAULT_TRACK } from '@/track/trackComposer';
import { TRACK } from '@/utils/constants';

/**
 * Follow-camera world-scroller. Places the PLAYER'S current track position
 * at world origin AND aligns the current track heading with world -Z, so
 * the cockpit (camera at origin looking -Z) always sees the road ahead
 * regardless of how winding the composed track is.
 *
 * Transform: rotate world around Y by -trackHeading, then translate by
 * -playerWorldPos. The Three.js `group.rotation` + `group.position` apply
 * as point' = R * p + T, so to achieve the desired inverse-of-player-pose
 * transform we pre-rotate the negated player position.
 */
export function WorldScroller({ children }: { children: ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  const composition = useMemo(() => composeTrack(DEFAULT_TRACK, 10), []);

  useFrame((state) => {
    const s = useGameStore.getState();
    const g = groupRef.current;
    if (!g) return;

    const playerLat = Math.max(-TRACK.LATERAL_CLAMP, Math.min(TRACK.LATERAL_CLAMP, s.lateral));
    const pose = trackToWorld(composition, s.distance, playerLat);

    // The camera should end up at pose in the WORLD frame, looking along pose.heading.
    // World rendering needs the inverse: group rotates by -pose.heading and translates
    // so the player's world-position ends at origin.
    const rotY = -pose.heading;
    const cosH = Math.cos(rotY);
    const sinH = Math.sin(rotY);
    // Rotate the negated player position by rotY before applying as group translation
    // so that rotation ∘ translation composes into the correct inverse transform.
    const rx = cosH * -pose.x + sinH * -pose.z;
    const rz = -sinH * -pose.x + cosH * -pose.z;
    g.position.set(rx, -1.5, rz);
    g.rotation.y = rotY;

    let trackPieces = 0;
    let meshes = 0;
    const trackGroup = g.getObjectByName('track');
    if (trackGroup) trackPieces = trackGroup.children.length;
    g.traverse((o) => {
      if (o.type === 'Mesh') meshes++;
    });
    // biome-ignore lint/suspicious/noExplicitAny: dev diagnostic
    const w = window as any;
    if (w.__mmDebug === true) {
      const _tmp = new THREE.Vector3();
      w.__mmDebugTrack = trackGroup?.children.map((c, i) => ({
        index: i,
        worldPos: c.getWorldPosition(_tmp.clone()).toArray(),
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
  });

  return <group ref={groupRef}>{children}</group>;
}
