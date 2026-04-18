/**
 * @module app/GameLoop
 *
 * Per-frame game loop component. Lives inside <Canvas> so it has access to
 * useFrame. Drives: player motion, collision resolution, game-over detection,
 * achievements, ghost recorder, and the full game-state tick.
 *
 * Extracted from App.tsx to keep that file under 300 LOC.
 */
import { useFrame } from '@react-three/fiber';
import type { World } from 'koota';
import { type EndReason, resetGameOver, stepGameOver } from '@/ecs/systems/gameOver';
import { usePlayerLoop } from '@/ecs/systems/usePlayerLoop';
import {
  Obstacle,
  type ObstacleKind,
  Pickup,
  type PickupKind,
  Player,
  Speed,
  Steer,
  TrackSegment,
} from '@/ecs/traits';
import { resetAchievementsRun, stepAchievements } from '@/game/achievementRun';
import { reportCounts, reportFrame, reportScene } from '@/game/diagnosticsBus';
import { ensureGameTraits, tick, useGameStore } from '@/game/gameState';
import { commitGhost, resetGhostRecorder, stepGhostRecorder } from '@/game/ghost';
import { sampleFrame } from '@/game/replayRecorder';

interface GameLoopProps {
  world: World;
  active: boolean;
  onPickup: (kind: PickupKind) => void;
  onObstacle: (kind: ObstacleKind) => void;
  onEnd: (reason: EndReason) => void;
}

export function GameLoop({ world, active, onPickup, onObstacle, onEnd }: GameLoopProps) {
  usePlayerLoop(world, active, { onPickup, onObstacle });
  useFrame((state, dt) => {
    const clamped = Math.min(dt, 0.066);
    if (active) {
      const now = performance.now();
      // Advance the full game-state tick (speed, distance, hype, zones, etc.)
      tick(clamped, now);
      stepGameOver(world, { onEnd });
      stepAchievements(world);
      stepGhostRecorder(world);

      // Replay recorder — throttled to ~30Hz inside sampleFrame itself.
      // Start/stop lifecycle is owned by gameState.startRun / endRun.
      const pe = world.query(Player, Speed, Steer)[0];
      if (pe) {
        const speed = pe.get(Speed)?.value ?? 0;
        const steer = pe.get(Steer)?.value ?? 0;
        const lateral = useGameStore.getState().lateral;
        sampleFrame(now, lateral, speed, steer);
      }
    }
    reportFrame(clamped);

    // Report ECS counts + renderer stats to the diagnostics bus so
    // window.__mm.diag() reflects actual scene state. Essential for the
    // seed-playthrough test factory to verify obstacles/pickups render.
    const obstacleCount = world.query(Obstacle).length;
    const pickupCount = world.query(Pickup).length;
    const trackPieces = world.query(TrackSegment).length;
    reportCounts(obstacleCount, pickupCount, state.gl.info.render.calls);
    reportScene({
      trackPieces,
      meshesRendered: state.gl.info.render.triangles,
      cameraPos: [state.camera.position.x, state.camera.position.y, state.camera.position.z],
      worldScrollerPos: [0, 0, 0],
    });
  });
  return null;
}

export { commitGhost, ensureGameTraits, resetAchievementsRun, resetGameOver, resetGhostRecorder };
