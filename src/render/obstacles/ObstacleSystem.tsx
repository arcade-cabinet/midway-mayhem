/**
 * ObstacleSystem — honk-scare bridge (GLB-free).
 *
 * All obstacle visuals are rendered by TrackContent.tsx (Path A — canonical
 * ECS path). This component's sole job is to subscribe to the onHonk event
 * bus and mutate the flee state on nearby critter Obstacle entities so
 * TrackContent.tsx can animate them fleeing.
 *
 * Returns null — no geometry rendered here.
 */
import { useWorld } from 'koota/react';
import { useEffect } from 'react';
import { onHonk } from '@/audio/honkBus';
import { Obstacle } from '@/ecs/traits';
import { combo } from '@/game/comboSystem';
import { incrementScares, useGameStore } from '@/game/gameState';
import { eventsRng } from '@/game/runRngBus';
import { HONK } from '@/utils/constants';

export function ObstacleSystem() {
  const world = useWorld();

  useEffect(() => {
    return onHonk(() => {
      const s = useGameStore.getState();
      if (!s.running) return;
      const nowMs = performance.now();
      const playerD = s.distance;
      const rng = eventsRng();
      let scared = 0;

      for (const e of world.query(Obstacle)) {
        const ob = e.get(Obstacle);
        if (!ob || ob.kind !== 'critter') continue;
        // Already fleeing — don't re-scare.
        if (ob.fleeStartedAt > 0) continue;
        const ahead = ob.distance - playerD;
        if (ahead < 0 || ahead > HONK.SCARE_RADIUS_M) continue;
        const fleeDir = (rng.next() < 0.5 ? -1 : 1) as -1 | 1;
        e.set(Obstacle, { ...ob, fleeStartedAt: nowMs, fleeDir });
        scared++;
      }

      if (scared > 0) {
        for (let i = 0; i < scared; i++) {
          combo.registerEvent('scare');
          incrementScares(world);
        }
        const mult = combo.getMultiplier();
        useGameStore.setState({
          crowdReaction: useGameStore.getState().crowdReaction + scared * 10 * mult,
        });
      }
    });
  }, [world]);

  return null;
}
