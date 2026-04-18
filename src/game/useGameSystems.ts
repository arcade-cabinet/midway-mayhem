/**
 * @module game/useGameSystems
 *
 * Owns the zone-gimmick singletons whose render layers read them off the
 * window (BalloonSpawner → BalloonLayer, MirrorDuplicator → MirrorLayer),
 * subscribes to store transitions for zone audio + daily-runs persistence,
 * and ticks the gimmicks every RAF while a run is live.
 *
 * Not owned here (other owners):
 *   - TrickSystem + RampDetect          → GameLoop.tsx
 *   - RaidDirector                      → render/obstacles/RaidBridge.tsx
 *   - Run lifecycle (startRun/endRun)   → TitleScreen + useGameStore
 *   - Replay sampleFrame                → GameLoop.tsx
 *   - recordRun / finishAndMaybeSave    → runEndPersistence.ts
 */

import { sql } from 'drizzle-orm';
import { useEffect } from 'react';
import { audioBus } from '@/audio/audioBus';
import { honk } from '@/audio/honkBus';
import { tireSqueal } from '@/audio/tireSqueal';
import { reportError } from '@/game/errorBus';
import { useGameStore } from '@/game/gameState';
import { BalloonSpawner } from '@/game/obstacles/balloonSpawner';
import { MirrorDuplicator } from '@/game/obstacles/mirrorDuplicator';
import { eventsRng } from '@/game/runRngBus';
import { db, persistToOpfs } from '@/persistence/db';
import { dailyRuns } from '@/persistence/schema';
import { getDailySeed, isDailyRoute, utcDateString } from '@/track/dailyRoute';

declare global {
  interface Window {
    __mmBalloonSpawner?: BalloonSpawner | undefined;
    __mmMirrorDuplicator?: MirrorDuplicator | undefined;
    __mmHonk?: (() => void) | undefined;
    __mmSpawner?:
      | { getObstacles: () => readonly { id: number; lane: number; d: number }[] }
      | undefined;
  }
}

export function useGameSystems(): void {
  useEffect(() => {
    window.__mmHonk = () => honk();

    const eRng = eventsRng();
    const balloonSpawner = new BalloonSpawner(eRng);
    const mirrorDuplicator = new MirrorDuplicator(eRng);
    window.__mmBalloonSpawner = balloonSpawner;
    window.__mmMirrorDuplicator = mirrorDuplicator;

    const unsub = useGameStore.subscribe((s, prev) => {
      if (s.currentZone !== prev.currentZone) audioBus.setZone(s.currentZone);

      if (s.gameOver && !prev.gameOver && isDailyRoute()) {
        const today = utcDateString();
        const seed = s.seed || getDailySeed();
        const distCm = Math.round(s.distance * 100);
        const crowd = s.crowdReaction;
        db()
          .insert(dailyRuns)
          .values({ dateUtc: today, seed, bestDistanceCm: distCm, bestCrowd: crowd, runCount: 1 })
          .onConflictDoUpdate({
            target: dailyRuns.dateUtc,
            set: {
              seed,
              bestDistanceCm: sql`MAX(${dailyRuns.bestDistanceCm}, excluded.best_distance_cm)`,
              bestCrowd: sql`MAX(${dailyRuns.bestCrowd}, excluded.best_crowd)`,
              runCount: sql`${dailyRuns.runCount} + 1`,
            },
          })
          .catch((err: unknown) => reportError(err, 'useGameSystems.dailyRuns.upsert'));
        persistToOpfs().catch((err: unknown) => reportError(err, 'useGameSystems.persistToOpfs'));
      }
    });

    let rafId = 0;
    function gimmickLoop() {
      const s = useGameStore.getState();
      const now = performance.now();
      if (s.running) {
        balloonSpawner.update(s.distance, s.currentZone, now);
        const spawner = window.__mmSpawner;
        if (spawner) mirrorDuplicator.sync(spawner.getObstacles(), s.currentZone);
        const hitId = balloonSpawner.checkCollision(s.distance, s.lateral, now);
        if (hitId !== null) {
          balloonSpawner.consumeBalloon(hitId);
          useGameStore.setState((prev) => ({ crowdReaction: prev.crowdReaction + 30 }));
        }
      }
      rafId = requestAnimationFrame(gimmickLoop);
    }
    gimmickLoop();

    const unsubSqueal = tireSqueal.subscribe();
    return () => {
      unsub();
      unsubSqueal();
      cancelAnimationFrame(rafId);
      window.__mmBalloonSpawner = undefined;
      window.__mmMirrorDuplicator = undefined;
      window.__mmHonk = undefined;
    };
  }, []);
}
