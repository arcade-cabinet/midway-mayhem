/**
 * Speed-lines overlay — thin white radial streaks emanating from the
 * forward vanishing point, intensity scaling with Speed. Only visible at
 * high speed so cruise feels normal but boost feels fast.
 *
 * Implemented as camera-parented geometry (the cockpit has a PerspectiveCamera
 * inside it) — we reach the camera via useThree and parent a static set of
 * line segments that fan out from the center of the frame. Updating only
 * material opacity each frame is cheap.
 */
import { useFrame, useThree } from '@react-three/fiber';
import { useWorld } from 'koota/react';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { tunables } from '@/config';
import { Player, Score, Speed } from '@/ecs/traits';

const LINE_COUNT = 32;
const RING_RADIUS = 0.8; // relative to the near plane (arbitrary; camera-space)
const LINE_LENGTH = 0.9;

export function SpeedLines() {
  const { camera } = useThree();
  const world = useWorld();
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.LineBasicMaterial>(null);

  const geometry = useMemo(() => {
    const positions: number[] = [];
    for (let i = 0; i < LINE_COUNT; i++) {
      const a = (i / LINE_COUNT) * Math.PI * 2;
      const x1 = Math.cos(a) * RING_RADIUS;
      const y1 = Math.sin(a) * RING_RADIUS;
      const x2 = Math.cos(a) * (RING_RADIUS + LINE_LENGTH);
      const y2 = Math.sin(a) * (RING_RADIUS + LINE_LENGTH);
      // lines are drawn on a plane at z = -1 (just past near plane).
      positions.push(x1, y1, -1, x2, y2, -1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return g;
  }, []);

  useFrame(() => {
    const g = groupRef.current;
    const m = matRef.current;
    if (!g || !m) return;
    // Re-parent to the camera so lines follow view orientation.
    if (g.parent !== camera) {
      camera.add(g);
      g.position.set(0, 0, 0);
      g.rotation.set(0, 0, 0);
    }
    const player = world.query(Player, Speed, Score)[0];
    if (!player) return;
    const s = player.get(Speed);
    const sc = player.get(Score);
    if (!s || !sc) return;
    const norm = Math.min(1, s.value / tunables.cruiseMps);
    // Kick in past 0.6 of cruise, saturates at 1.0; boost pushes past 1.
    const vis = Math.max(0, (norm - 0.6) / 0.4);
    // Boost-window amplification: during boost, opacity nearly doubles
    // and stays saturated even if the player briefly lifts off throttle.
    const boosting = sc.boostRemaining > 0;
    const base = boosting ? 1.0 : vis;
    m.opacity = Math.min(0.85, base * 0.55 + (boosting ? 0.25 : 0));
  });

  return (
    <group ref={groupRef}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          ref={matRef}
          color="#ffffff"
          transparent
          opacity={0}
          linewidth={1}
          depthTest={false}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}
