/**
 * Player motion helpers.
 *
 * `spawnPlayer` creates the Player entity with its motion traits.
 *
 * `stepPlayer` is a minimal physics integrator for isolated browser tests
 * that mount Track + Cockpit without the full gameState system. When the
 * ported gameState is driving a run (RunSession.running === true), it owns
 * Position/Speed/Score exclusively and stepPlayer becomes a no-op so the
 * two don't fight over the same traits.
 */
import type { World } from 'koota';
import { trackArchetypes, tunables } from '@/config';
import { Player, Position, RunSession, Score, Speed, Steer, Throttle } from '@/ecs/traits';

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
 * Advance player state by one frame. `dt` is seconds. When a RunSession is
 * active this is a no-op (gameStateTick owns the writes). In bare-Canvas
 * isolation tests where RunSession has never been added, this falls through
 * and does an exponential-approach to cruise and a distance integration.
 */
export function stepPlayer(world: World, dt: number): void {
  const runActive = world.query(Player, RunSession).length > 0;
  if (runActive) return;

  const { cruiseMps, maxSteerRate, throttleResponse } = tunables;
  const halfWidth = (trackArchetypes.laneWidth * trackArchetypes.lanes) / 2;
  const maxLateral = halfWidth - trackArchetypes.laneWidth * 0.4;

  world
    .query(Player, Speed, Steer, Throttle, Position)
    .updateEach(([speed, steer, throttle, pos]) => {
      const tgt = throttle.value > 0 ? cruiseMps : throttle.value < 0 ? 0 : cruiseMps * 0.4;
      speed.target = tgt;
      const k = 1 - Math.exp(-throttleResponse * dt);
      speed.value += (speed.target - speed.value) * k;

      pos.distance += speed.value * dt;
      pos.lateral += steer.value * maxSteerRate * dt;
      if (pos.lateral > maxLateral) pos.lateral = maxLateral;
      if (pos.lateral < -maxLateral) pos.lateral = -maxLateral;
    });
}
