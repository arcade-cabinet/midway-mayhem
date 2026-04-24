/**
 * @module app/GameLoop
 *
 * Per-frame game loop component. Lives inside <Canvas> so it has access to
 * useFrame. Drives: player motion, collision resolution, game-over detection,
 * achievements, ghost recorder, trick system, and the full game-state tick.
 *
 * Extracted from App.tsx so App stays a composition file (mounts
 * subsystems, wires contexts) while GameLoop owns the per-frame
 * responsibility. Different responsibilities, different files.
 */
import { useFrame } from '@react-three/fiber';
import type { World } from 'koota';
import { useRef } from 'react';
import { tunables } from '@/config';
import { type EndReason, resetGameOver, stepGameOver } from '@/ecs/systems/gameOver';
import { usePlayerLoop } from '@/ecs/systems/usePlayerLoop';
import {
  Obstacle,
  type ObstacleKind,
  Pickup,
  type PickupKind,
  Player,
  Position,
  Score,
  Speed,
  Steer,
} from '@/ecs/traits';
import { resetAchievementsRun, stepAchievements } from '@/game/achievementRun';
import { combo } from '@/game/comboSystem';
import { reportCounts, reportEcsStats, reportFrame } from '@/game/diagnosticsBus';
import {
  applyCrash,
  ensureGameTraits,
  setAirborne,
  setTrickState,
  tick,
  useGameStore,
} from '@/game/gameState';
import { commitGhost, resetGhostRecorder, stepGhostRecorder } from '@/game/ghost';
import { RampDetect } from '@/game/rampDetect';
import { sampleFrame } from '@/game/replayRecorder';
import { trickInputBus } from '@/game/trickInputBus';
import { TrickSystem } from '@/game/trickSystem';

interface GameLoopProps {
  world: World;
  active: boolean;
  onPickup: (kind: PickupKind) => void;
  onObstacle: (kind: ObstacleKind) => void;
  onEnd: (reason: EndReason) => void;
}

export function GameLoop({ world, active, onPickup, onObstacle, onEnd }: GameLoopProps) {
  usePlayerLoop(world, active, { onPickup, onObstacle });

  // Trick system instances persist for the lifetime of the component.
  // Using plain refs (not state) so mutations don't trigger re-renders.
  const trickSystemRef = useRef<TrickSystem | null>(null);
  const rampDetectRef = useRef<RampDetect | null>(null);

  if (trickSystemRef.current === null) trickSystemRef.current = new TrickSystem();
  if (rampDetectRef.current === null) rampDetectRef.current = new RampDetect();

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

      // ── Trick system ─────────────────────────────────────────────────────
      const trickSystem = trickSystemRef.current!;
      const rampDetect = rampDetectRef.current!;
      const gs = useGameStore.getState();

      // Ramp detection: Y-rise look-ahead + piece-kind fallback for
      // Kenney ramp pieces that will be wired in later.
      const onRampPiece =
        gs.currentPieceKind === 'ramp' ||
        gs.currentPieceKind === 'rampLong' ||
        gs.currentPieceKind === 'rampLongCurved';
      const isAirborne = rampDetect.update(gs.distance, gs.speedMps, now) || onRampPiece;

      // Sync ECS airborne trait so other systems (camera shake, etc.) can read it.
      setAirborne(isAirborne, world);

      // Forward any queued trick inputs from keyboard/touch into TrickSystem.
      const pendingInputs = trickInputBus.drain();
      for (const input of pendingInputs) {
        trickSystem.pushInput(input, now);
      }

      // Advance trick animation and fire landing callbacks.
      trickSystem.update(now, isAirborne, {
        onCleanLanding: () => {
          const trickState = trickSystem.getState();
          const rotations = trickState.currentTrick
            ? Math.abs(trickState.currentTrick.totalAngle) / (Math.PI * 2)
            : 1;
          const t = tunables.tricks;
          const bonus = t.trickScoreBase + Math.round(rotations * t.trickScorePerRot);
          useGameStore.setState((prev) => ({
            sanity: Math.min(100, prev.sanity + t.cleanSanityReward),
            crowdReaction: prev.crowdReaction + t.cleanCrowdReward + bonus,
          }));
          combo.registerEvent('pickup');
        },
        onBotchedLanding: () => {
          applyCrash(false, world);
        },
      });

      // Push trick rotations into ECS TrickState so cockpit/camera can read.
      const ts = trickSystem.getState();
      setTrickState(ts.currentTrick !== null, ts.rotY, ts.rotZ, world);
    }
    reportFrame(clamped);

    // Report ECS counts only. Scene info (cameraPos, worldScrollerPos,
    // meshesRendered, trackPieces) is reported by TrackScroller each frame
    // with the live values — clobbering it here with [0,0,0] stubs made
    // diagnostics useless for debugging the scene. Don't re-report here.
    const obstacleCount = world.query(Obstacle).length;
    const pickupCount = world.query(Pickup).length;
    reportCounts(obstacleCount, pickupCount, state.gl.info.render.calls);

    // Expose ECS Score.damage + Position for live debugging — the store's
    // `crashes` counter is not wired to Score.damage (see #130), so the
    // only way to see how close the run is to a damage-end is to read the
    // ECS trait directly.
    const pe2 = world.query(Player, Score, Position)[0];
    if (pe2) {
      const sc = pe2.get(Score);
      const po = pe2.get(Position);
      if (sc && po) {
        reportEcsStats({
          ecsDamage: sc.damage,
          ecsDistance: po.distance,
          ecsLateral: po.lateral,
          ecsBoostRemaining: sc.boostRemaining,
          ecsCleanSeconds: sc.cleanSeconds,
        });
      }
    }
  });
  return null;
}

export { commitGhost, ensureGameTraits, resetAchievementsRun, resetGameOver, resetGhostRecorder };
