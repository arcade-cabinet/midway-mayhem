import { useFrame } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../systems/gameState';
import { STEER } from '../utils/constants';

/**
 * Translates the world opposite to the player's forward motion so that
 * the cockpit at world origin *appears* to race through the track.
 *
 * Forward axis is -Z. As distance increases, world translates +Z.
 * Lateral steer translates world on +X (opposite of car motion).
 */
export function WorldScroller({ children }: { children: ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const s = useGameStore.getState();
    if (!groupRef.current) return;
    // Track sits BELOW cockpit: offset -1.5 so road surface reads as the ground we're driving on.
    const playerLat = Math.max(-10, Math.min(10, s.lateral));
    groupRef.current.position.set(-playerLat, -1.5, s.distance);
    void STEER;
  });

  return <group ref={groupRef}>{children}</group>;
}
