/**
 * @module game/governor/Governor
 *
 * R3F component that injects Governor steering input when ?governor=1 or
 * ?autoplay=1 is set. Must live inside <Canvas> because useFrame is R3F-scoped.
 *
 * Writes the driver's continuous steer output directly to the Steer trait
 * each frame. Previously synthesized ArrowLeft/Right keydown events, which
 * went through useKeyboard and clamped steer to discrete ±1 — the result
 * was autopilot always pinning the wheel fully left/right whenever any
 * correction was needed, making the steering wheel look broken even when
 * the actual lateral correction was small.
 */
import { useFrame } from '@react-three/fiber';
import { useWorld } from 'koota/react';
import { useEffect, useRef } from 'react';
import { Obstacle, Pickup, Player, Position, Steer, Throttle } from '@/ecs/traits';
import { useGameStore } from '@/game/gameState';
import { GovernorDriver } from './GovernorDriver';

export function Governor() {
  const world = useWorld();
  const enabled = useRef(false);
  const driverRef = useRef(new GovernorDriver());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    // Activate on both ?governor=1 (legacy) and ?autoplay=1 (new URL flag)
    enabled.current = params.get('governor') === '1' || params.get('autoplay') === '1';
    if (enabled.current) {
      // biome-ignore lint/suspicious/noExplicitAny: test hook
      (window as any).__mmGovernor = driverRef.current;
    }
  }, []);

  useFrame((_, dt) => {
    if (!enabled.current) return;
    // Autopilot: always floor the throttle so the car actually moves
    // regardless of whether RunSession.running has been toggled by the
    // title-screen startRun() flow.
    world.query(Player, Throttle).updateEach(([t]) => {
      t.value = 1;
    });
    const s = useGameStore.getState();
    if (!s.running) return;

    // Read player distance/lateral from the authoritative ECS source
    // (Position trait, kept in sync by gameStateTick).
    const playerEntity = world.query(Player, Position)[0];
    const playerPos = playerEntity?.get(Position);
    const playerD = playerPos?.distance ?? s.distance;
    const playerLateral = playerPos?.lateral ?? s.lateral;

    // Query obstacles + pickups from ECS directly — no reliance on the
    // reference spawner bridge. Only perceive entities that are ahead
    // of the player and within the perception horizon.
    const PERCEPTION_AHEAD_M = 60;
    const obstacles: Array<{
      d: number;
      x: number;
      z: number;
      type: string;
      radius: number;
    }> = [];
    world.query(Obstacle).updateEach(([ob]) => {
      if (ob.consumed) return;
      const ahead = ob.distance - playerD;
      if (ahead > 0 && ahead < PERCEPTION_AHEAD_M) {
        obstacles.push({
          d: ob.distance,
          x: ob.lateral,
          z: 0,
          type: ob.kind,
          radius: ob.kind === 'cone' ? 0.5 : 0.7,
        });
      }
    });
    const pickups: Array<{ d: number; x: number; z: number; type: string; radius: number }> = [];
    world.query(Pickup).updateEach(([pu]) => {
      if (pu.consumed) return;
      const ahead = pu.distance - playerD;
      if (ahead > 0 && ahead < PERCEPTION_AHEAD_M) {
        pickups.push({
          d: pu.distance,
          x: pu.lateral,
          z: 0,
          type: pu.kind,
          radius: 0.7,
        });
      }
    });

    const result = driverRef.current.step({ playerD, playerLateral, obstacles, pickups }, dt);
    // Write the continuous steer value directly to the Steer trait so the
    // wheel rotates proportionally and the motion integration gets the
    // actual intent (not a discrete ±1 keyboard synth).
    world.query(Player, Steer).updateEach(([s]) => {
      s.value = Math.max(-1, Math.min(1, result.steer));
    });
  });

  return null;
}
