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
 *
 * LANE-SNAP PATH (mobile):
 * When the player entity has the Lane trait (added by TouchControls on mount),
 * lateral position eases toward the target lane centre via exponential approach
 * rather than integrating Steer. lane.current is committed once the car is
 * within LANE_SNAP_EPSILON metres of the target centre.
 *
 * STEER PATH (desktop):
 * When Lane is absent, the original Steer-based continuous motion applies.
 * Desktop players keep full analogue control via keyboard/mouse.
 */
import type { World } from 'koota';
import { trackArchetypes, tunables } from '@/config';
import {
  Lane,
  LaneCount,
  Player,
  Position,
  RunSession,
  Score,
  Speed,
  Steer,
  Throttle,
} from '@/ecs/traits';

/** Exponential-approach time constant for lane-snap (seconds to settle). */
const LANE_SNAP_TAU_S = 0.18;

/** Snap lane.current once within this distance of the target centre (metres). */
const LANE_SNAP_EPSILON_M = 0.08;

/**
 * Return the world-space lateral position for lane index `i` given total
 * lane count and lane width. Lane 0 is leftmost; the centreline is at 0.
 */
export function laneCenter(index: number, laneCount: number, laneWidth: number): number {
  const trackHalfWidth = (laneCount * laneWidth) / 2;
  return -trackHalfWidth + laneWidth * 0.5 + index * laneWidth;
}

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

  const { throttleResponse } = tunables;
  const { cruiseMps } = tunables.speed;
  const { laneWidth, lanes } = trackArchetypes;
  const halfWidth = (laneWidth * lanes) / 2;
  const maxLateral = halfWidth - laneWidth * 0.4;

  // ── Lane-snap path (mobile: Lane trait present) ─────────────────────────
  world
    .query(Player, Speed, Throttle, Position, Lane, LaneCount)
    .updateEach(([speed, throttle, pos, lane, laneCount]) => {
      const tgt = throttle.value > 0 ? cruiseMps : throttle.value < 0 ? 0 : cruiseMps * 0.4;
      speed.target = tgt;
      const k = 1 - Math.exp(-throttleResponse * dt);
      speed.value += (speed.target - speed.value) * k;
      pos.distance += speed.value * dt;

      const targetLateral = laneCenter(lane.target, laneCount.value, laneWidth);
      const snapK = 1 - Math.exp(-dt / LANE_SNAP_TAU_S);
      pos.lateral += (targetLateral - pos.lateral) * snapK;

      if (Math.abs(pos.lateral - targetLateral) < LANE_SNAP_EPSILON_M) {
        pos.lateral = targetLateral;
        lane.current = lane.target;
      }
    });

  // ── Steer-continuous path (desktop: no Lane trait) ──────────────────────
  const { maxSteerRate } = tunables;
  world
    .query(Player, Speed, Steer, Throttle, Position)
    .updateEach(([speed, steer, throttle, pos], entity) => {
      // Skip entities handled by the lane-snap path above.
      if (entity.has(Lane)) return;

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
