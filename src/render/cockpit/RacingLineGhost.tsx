/**
 * @module cockpit/RacingLineGhost
 *
 * Racing-line ghost overlay — a translucent wireframe car clone that floats
 * AHEAD of the player at the optimal lateral position for their current
 * distance + LOOKAHEAD_M. Gives an immediate, readable cue for where the
 * ideal line would place you.
 *
 * Lives in WORLD-SPACE (not cockpit-space). Mounted as a sibling of GhostCar
 * inside WorldScroller so the WorldScroller's inverse-player-pose transform
 * already maps "distance+lookahead, lateralM" → the correct world position
 * ahead of the cockpit. The z-offset of -LOOKAHEAD_M places the ghost 12m
 * down the track in front of the player.
 *
 * Visibility rules:
 *   - state.running && !state.gameOver
 *   - settings.showRacingLine === true
 *   - plan is available (solveOptimalPath succeeds synchronously once)
 *
 * Plunge safety: because this component lives inside WorldScroller (world-
 * space), it stays attached to the moving track geometry. When the cockpit
 * plunges, the ghost correctly remains on-track rather than following the
 * cockpit's falling offset.
 */

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { reportError } from '@/game/errorBus';
import { useGameStore } from '@/game/gameState';
import { type OptimalPath, optimalLateralAt, solveOptimalPath } from '@/game/optimalPath';
import { type GameSettings, getSettings, SETTINGS_CHANGED_EVENT } from '@/persistence/settings';
import { COLORS } from '@/utils/constants';

// ─── Tuning ──────────────────────────────────────────────────────────────────

/** How far ahead (metres along track) the ghost is rendered. */
const LOOKAHEAD_M = 12;

// ─── Wireframe ghost mesh ────────────────────────────────────────────────────

/**
 * Simple polka-dot clown-car silhouette — same proportions as GhostCar but
 * rendered wireframe in brand yellow at 35% opacity so it reads as a guide
 * rather than a competing car.
 */
function RacingLineGhostMesh({ groupRef }: { groupRef: React.RefObject<THREE.Group | null> }) {
  const mat = new THREE.MeshBasicMaterial({
    color: COLORS.YELLOW,
    transparent: true,
    opacity: 0.35,
    wireframe: true,
  });

  return (
    <group ref={groupRef} name="racing-line-ghost">
      {/* Hood silhouette */}
      <mesh position={[0, 0, -1.5]} material={mat} scale={[0.85, 0.65, 1.1]}>
        <sphereGeometry args={[0.9, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* Cabin box */}
      <mesh position={[0, 0.8, 0.2]} material={mat}>
        <boxGeometry args={[1.6, 1.0, 1.4]} />
      </mesh>
      {/* Polka dot accents */}
      <mesh position={[-0.4, 0.1, -1.2]} material={mat}>
        <sphereGeometry args={[0.14, 8, 6]} />
      </mesh>
      <mesh position={[0.4, 0.3, -1.4]} material={mat}>
        <sphereGeometry args={[0.14, 8, 6]} />
      </mesh>
      <mesh position={[0, 0.5, -1.7]} material={mat}>
        <sphereGeometry args={[0.1, 8, 6]} />
      </mesh>
    </group>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function RacingLineGhost() {
  const groupRef = useRef<THREE.Group>(null);
  const optimalPathRef = useRef<OptimalPath | null>(null);
  const [showRacingLine, setShowRacingLine] = useState(true);

  // Load initial settings and subscribe to changes
  useEffect(() => {
    getSettings()
      .then((s) => setShowRacingLine(s.showRacingLine))
      .catch((err) => reportError(err, 'RacingLineGhost.getSettings'));

    const handler = (e: Event) => {
      const detail = (e as CustomEvent<GameSettings>).detail;
      setShowRacingLine(detail.showRacingLine);
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, handler);
  }, []);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;

    const s = useGameStore.getState();

    // Only visible when actively running, not game-over, and setting allows
    if (!s.running || s.gameOver || !showRacingLine) {
      g.visible = false;
      return;
    }

    // Lazily solve optimal path once per run when the plan becomes available
    if (!optimalPathRef.current || optimalPathRef.current.seed !== s.plan?.seed) {
      if (!s.plan) {
        g.visible = false;
        return;
      }
      optimalPathRef.current = solveOptimalPath(s.plan);
    }

    const path = optimalPathRef.current;
    const targetLateral = optimalLateralAt(path, s.distance + LOOKAHEAD_M);

    // Position in world-space relative to WorldScroller:
    //   x = optimal lateral offset from centreline
    //   y = 0 (track surface)
    //   z = -LOOKAHEAD_M (ahead of the player who is at z=0 after WorldScroller transform)
    g.position.set(targetLateral, 0, -LOOKAHEAD_M);
    g.visible = true;
  });

  return <RacingLineGhostMesh groupRef={groupRef} />;
}
