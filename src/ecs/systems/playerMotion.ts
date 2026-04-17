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
import { trackArchetypes, tunables } from '@/config';
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
export function stepPlayer(world: World, dt: number): void {
  const { cruiseMps, maxSteerRate, throttleResponse } = tunables;
  const halfWidth = (trackArchetypes.laneWidth * trackArchetypes.lanes) / 2;

  world
    .query(Player, Speed, Steer, Throttle, Position)
    .updateEach(([speed, steer, throttle, pos]) => {
      const tgt = throttle.value > 0 ? cruiseMps : throttle.value < 0 ? 0 : cruiseMps * 0.4;
      speed.target = tgt;
      // Exponential smoothing toward target.
      const k = 1 - Math.exp(-throttleResponse * dt);
      speed.value += (speed.target - speed.value) * k;

      pos.distance += speed.value * dt;
      pos.lateral += steer.value * maxSteerRate * dt;
      // Clamp lateral so the player can't drive off the paved surface.
      const maxLateral = halfWidth - trackArchetypes.laneWidth * 0.4;
      if (pos.lateral > maxLateral) pos.lateral = maxLateral;
      if (pos.lateral < -maxLateral) pos.lateral = -maxLateral;
    });
}
