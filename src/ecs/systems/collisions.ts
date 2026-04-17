/**
 * Collision + pickup system. Each frame, iterates obstacles + pickups
 * that are within a near-distance band of the player. Triggers callbacks
 * so the audio/haptics/score layers can react.
 */
import type { World } from 'koota';
import { tunables } from '@/config';
import { Obstacle, Pickup, Player, Position, Score, Speed } from '@/ecs/traits';

interface Callbacks {
  onObstacle?: (kind: 'cone' | 'oil') => void;
  onPickup?: (kind: 'balloon' | 'boost') => void;
}

/** Half-widths defining what counts as a hit. */
const HIT_DISTANCE = 2.4;
const HIT_LATERAL = 1.6;
/** When boost is active we cap speed higher than cruise. */
const BOOST_MULT = 1.6;

export function stepCollisions(world: World, dt: number, cb: Callbacks = {}): void {
  const playerEntities = world.query(Player, Position, Speed, Score);
  if (playerEntities.length === 0) return;
  const pe = playerEntities[0];
  if (!pe) return;
  const pos = pe.get(Position);
  const speed = pe.get(Speed);
  const score = pe.get(Score);
  if (!pos || !speed || !score) return;

  // Obstacles
  world.query(Obstacle).updateEach(([ob]) => {
    if (ob.consumed) return;
    const dDist = ob.distance - pos.distance;
    if (dDist < -8 || dDist > 12) return; // out of interest band
    if (Math.abs(dDist) < HIT_DISTANCE && Math.abs(ob.lateral - pos.lateral) < HIT_LATERAL) {
      ob.consumed = true;
      score.damage += 1;
      score.cleanSeconds = 0;
      cb.onObstacle?.(ob.kind);
      if (ob.kind === 'cone') {
        // Cones briefly slow the player.
        speed.value *= 0.6;
      }
    }
  });

  // Pickups
  world.query(Pickup).updateEach(([pu]) => {
    if (pu.consumed) return;
    const dDist = pu.distance - pos.distance;
    if (dDist < -4 || dDist > 4) return;
    if (Math.abs(dDist) < HIT_DISTANCE && Math.abs(pu.lateral - pos.lateral) < HIT_LATERAL) {
      pu.consumed = true;
      if (pu.kind === 'balloon') {
        score.value += 100;
        score.balloons += 1;
      } else {
        score.boostRemaining = 2.5;
      }
      cb.onPickup?.(pu.kind);
    }
  });

  // Boost countdown + speed override
  if (score.boostRemaining > 0) {
    score.boostRemaining = Math.max(0, score.boostRemaining - dt);
    // Elevate effective target; stepPlayer handles the lerp next frame.
    speed.target = tunables.cruiseMps * BOOST_MULT;
  }

  // Combo: pure distance gain * cleanSeconds as a multiplier.
  score.cleanSeconds += dt;
  score.value += speed.value * dt * (1 + score.cleanSeconds * 0.02);
}
