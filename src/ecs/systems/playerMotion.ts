/**
 * Player motion system.
 *
 * Advances Position.distance by current Speed each frame, nudges
 * Position.lateral by Steer (clamped to track half-width), and lerps
 * Speed.value toward Speed.target based on Throttle. Called from a
 * per-frame hook via useFrame.
 *
 * No rendering here. Rendering reads Position + Speed through queries.
 */
import type { World } from 'koota';
import { Player, Position, Score, Speed, Steer, Throttle } from '@/ecs/traits';

export function spawnPlayer(world: World): void {
  world.spawn(
    Player,
    Speed({ value: 0, target: 0 }),
    Steer({ value: 0 }),
    Throttle({ value: 0 }),
    Position({ distance: 0, lateral: 0 }),
    Score({ value: 0, balloons: 0, boostRemaining: 0, damage: 0, cleanSeconds: 0 }),
  );
}

/**
 * Advance player state by one frame. Input: `dt` seconds.
 *
 * Throttle mapping:
 *   throttle > 0  → target = cruiseMps (full accel toward cruise)
 *   throttle = 0  → target = cruiseMps * 0.4 (coast)
 *   throttle < 0  → target = 0 (brake)
 */
export function stepPlayer(world: World, _dt: number): void {
  // gameStateTick is the authoritative driver of Position + Speed when a
  // RunSession is active. This step is now a no-op — kept so callers and
  // tests that import stepPlayer continue to work, and so the Player/Speed/
  // Steer/Throttle/Position query graph stays intact.
  //
  // Keyboard + TouchControls write Steer/Throttle on the ECS traits; those
  // are read by the governor path that funnels through gameState.setSteer
  // and similar bridges. Distance and speed evolve exclusively inside
  // gameStateTick so there's a single source of truth.
  void world;
}
