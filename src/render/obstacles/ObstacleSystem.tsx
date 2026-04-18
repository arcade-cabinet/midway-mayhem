/**
 * ObstacleSystem — honk-scare bridge for critter Obstacle entities.
 *
 * Canonical obstacle + pickup visuals now live in TrackContent.tsx (path A).
 * This component's sole remaining job is the honk-scare P0 feature:
 *   - Subscribe to onHonk events
 *   - Mutate the Obstacle trait on nearby critter entities (set fleeStartedAt + fleeDir)
 *   - Register combo scare events + update crowdReaction
 *
 * No GLBs. No /models/ paths. All geometry is in TrackContent primitives.
 *
 * Mount once as a sibling of TrackContent in the Canvas hierarchy. It renders
 * no geometry itself (returns null).
 */
import { useEffect } from 'react';
import { useWorld } from 'koota/react';
import { onHonk } from '@/audio/honkBus';
import { combo } from '@/game/comboSystem';
import { useGameStore } from '@/game/gameState';
import { eventsRng } from '@/game/runRngBus';
import { Obstacle } from '@/ecs/traits';
import { HONK } from '@/utils/constants';

export function ObstacleSystem() {
  const world = useWorld();
  // Re-query on mount only; the effect subscribes to honk and reads world at event time.
  useEffect(() => {
    return onHonk(() => {
      const s = useGameStore.getState();
      if (!s.running) return;

      const nowMs = performance.now();
      const playerD = s.distance;
      const rng = eventsRng();
      let scared = 0;

      // Iterate all critter Obstacle entities in range and start flee.
      for (const e of world.query(Obstacle)) {
        const ob = e.get(Obstacle);
        if (!ob || ob.kind !== 'critter') continue;
        if (ob.fleeStartedAt > 0) continue; // already fleeing
        const ahead = ob.distance - playerD;
        if (ahead < 0 || ahead > HONK.SCARE_RADIUS_M) continue;
        const fleeDir = (rng.next() < 0.5 ? -1 : 1) as -1 | 1;
        e.set(Obstacle, { ...ob, fleeStartedAt: nowMs, fleeDir });
        scared++;
      }

      if (scared > 0) {
        for (let i = 0; i < scared; i++) combo.registerEvent('scare');
        const mult = combo.getMultiplier();
        useGameStore.setState({
          crowdReaction: useGameStore.getState().crowdReaction + scared * 10 * mult,
        });
      }
    });
  }, [world]);

  return null;
}

// Re-export: world-transform used by peer obstacle layers (PickupSystem etc.)
export { trackToWorld } from '@/game/obstacles/trackToWorld';
// Re-export: pickIdleClip kept for any callers that previously imported from here
export { pickIdleClip } from '@/game/obstacles/critterPool';
