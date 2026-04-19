/**
 * Collision + pickup system. Each frame, iterates obstacles + pickups
 * that are within a near-distance band of the player. Triggers callbacks
 * so the audio/haptics/score layers can react.
 */
import type { World } from 'koota';
import { tunables } from '@/config';
import {
  Obstacle,
  type ObstacleKind,
  Pickup,
  type PickupKind,
  Player,
  Position,
  Score,
  Speed,
} from '@/ecs/traits';
import { combo } from '@/game/comboSystem';

interface Callbacks {
  onObstacle?: (kind: ObstacleKind) => void;
  onPickup?: (kind: PickupKind) => void;
}

/** Half-widths defining what counts as a hit. */
const HIT_DISTANCE = 2.4;
/**
 * Car half-width for collision. MUST be strictly smaller than the
 * half-lane-width (laneWidth/2 = 1.6) — otherwise a centered player at
 * lateral=0 picks up adjacent-lane obstacles whose centres sit at ±1.6
 * via floating-point drift (1.5999...9 < 1.6), ending every run around
 * the first obstacle. See #130.
 */
const HIT_LATERAL = 1.2;
/** Lateral band where a narrowly-missed obstacle counts as a near-miss. */
const NEAR_MISS_LATERAL = 2.8;
const NEAR_MISS_CROWD_BONUS = 5;
/** When boost is active we cap speed higher than cruise. */
const BOOST_MULT = 1.6;

interface PendingHit {
  damageDelta: number;
  speedMult: number;
  resetClean: boolean;
  valueDelta: number;
  balloonsDelta: number;
  boostSetTo: number | null;
  boostMaxTo: number | null;
}

function zeroHit(): PendingHit {
  return {
    damageDelta: 0,
    speedMult: 1,
    resetClean: false,
    valueDelta: 0,
    balloonsDelta: 0,
    boostSetTo: null,
    boostMaxTo: null,
  };
}

export function stepCollisions(world: World, dt: number, cb: Callbacks = {}): void {
  const playerEntities = world.query(Player, Position, Speed, Score);
  if (playerEntities.length === 0) return;
  const pe = playerEntities[0];
  if (!pe) return;
  const pos = pe.get(Position);
  if (!pos) return;

  // Accumulate everything that needs to be applied to the player's Score +
  // Speed in this tick. We can't mutate them here because koota's `.get()`
  // returns a snapshot, not a live ref — mutations would be lost. We apply
  // them via `updateEach` below.
  const pending = zeroHit();

  // Obstacles
  world.query(Obstacle).updateEach(([ob]) => {
    if (ob.consumed) return;
    const dDist = ob.distance - pos.distance;
    if (dDist < -8 || dDist > 12) return; // out of interest band
    const lateralDelta = Math.abs(ob.lateral - pos.lateral);
    if (Math.abs(dDist) < HIT_DISTANCE && lateralDelta < HIT_LATERAL) {
      ob.consumed = true;
      pending.resetClean = true;
      cb.onObstacle?.(ob.kind);
      switch (ob.kind) {
        case 'barrier':
          pending.damageDelta += 2;
          pending.speedMult *= 0.3;
          break;
        case 'cone':
          pending.damageDelta += 1;
          pending.speedMult *= 0.6;
          break;
        case 'gate':
          pending.damageDelta += 1;
          pending.speedMult *= 0.75;
          break;
        case 'oil':
          pending.speedMult *= 0.5;
          break;
        case 'hammer':
          pending.damageDelta += 2;
          pending.speedMult *= 0.4;
          break;
      }
    } else if (Math.abs(dDist) < HIT_DISTANCE && lateralDelta < NEAR_MISS_LATERAL) {
      ob.consumed = true;
      combo.registerEvent('near-miss');
      pending.valueDelta += NEAR_MISS_CROWD_BONUS;
    }
  });

  // Pickups
  world.query(Pickup).updateEach(([pu]) => {
    if (pu.consumed) return;
    const dDist = pu.distance - pos.distance;
    if (dDist < -4 || dDist > 4) return;
    if (Math.abs(dDist) < HIT_DISTANCE && Math.abs(pu.lateral - pos.lateral) < HIT_LATERAL) {
      pu.consumed = true;
      switch (pu.kind) {
        case 'balloon':
          pending.valueDelta += 100;
          pending.balloonsDelta += 1;
          break;
        case 'boost':
          pending.boostSetTo = 2.5;
          break;
        case 'mega':
          pending.boostMaxTo = Math.max(pending.boostMaxTo ?? 0, 3.5);
          pending.valueDelta += 250;
          break;
      }
      combo.registerEvent('pickup');
      cb.onPickup?.(pu.kind);
    }
  });

  // Apply pending deltas to the player's Score + Speed via live updateEach refs.
  world.query(Player, Score, Speed).updateEach(([s, sp]) => {
    if (pending.resetClean) s.cleanSeconds = 0;
    s.damage += pending.damageDelta;
    s.value += pending.valueDelta;
    s.balloons += pending.balloonsDelta;
    if (pending.boostSetTo !== null) s.boostRemaining = pending.boostSetTo;
    if (pending.boostMaxTo !== null)
      s.boostRemaining = Math.max(s.boostRemaining, pending.boostMaxTo);
    if (pending.speedMult !== 1) sp.value *= pending.speedMult;

    // Boost countdown + speed override
    if (s.boostRemaining > 0) {
      s.boostRemaining = Math.max(0, s.boostRemaining - dt);
      sp.target = tunables.cruiseMps * BOOST_MULT;
    }

    // Combo: pure distance gain * cleanSeconds as a multiplier.
    s.cleanSeconds += dt;
    s.value += sp.value * dt * (1 + s.cleanSeconds * 0.02);
  });
}
