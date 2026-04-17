/**
 * @module game/useGameSystems
 *
 * Initializes singleton game systems (BalloonSpawner, MirrorDuplicator,
 * RaidDirector, TrickSystem), wires the zone subscription, starts the
 * gimmick RAF loop, and tears everything down on unmount.
 *
 * Extracted from Game.tsx to keep that file under 300 LOC.
 */
import { useEffect } from 'react';
import { audioBus, honk } from '@/audio';
import { tireSqueal } from '@/audio/tireSqueal';
import { reportError } from '@/game/errorBus';
import { useGameStore } from '@/game/gameState';
import { finishAndMaybeSave, sampleFrame, startRecording } from '@/game/replayRecorder';
import { eventsRng } from '@/game/runRngBus';
import { TrickSystem } from '@/game/trickSystem';
import { BalloonSpawner } from '@/obstacles/balloonSpawner';
import { MirrorDuplicator } from '@/obstacles/mirrorDuplicator';
import { RaidDirector } from '@/obstacles/raidDirector';
import { db } from '@/persistence/db';
import { recordRun } from '@/persistence/profile';
import { dailyRuns } from '@/persistence/schema';
import { getDailySeed, isDailyRoute, utcDateString } from '@/track/dailyRoute';

interface StartRunOptions {
  seed?: number;
  seedPhrase?: string | null;
  difficulty?: import('@/game/difficulty').Difficulty;
  permadeath?: boolean;
}

export function useGameSystems(
  startRun: (opts?: StartRunOptions) => void,
): void {
  useEffect(() => {
    // biome-ignore lint/suspicious/noExplicitAny: test seed hook
    const overrideSeed = (window as any).__mmSeed as number | undefined;
    // biome-ignore lint/suspicious/noExplicitAny: NewRunModal commits via this hook
    const runConfig = (window as any).__mmRunConfig as
      | import('@/hud/NewRunModal').NewRunConfig
      | undefined;
    if (runConfig) {
      startRun({
        seed: runConfig.seed,
        seedPhrase: runConfig.seedPhrase,
        difficulty: runConfig.difficulty,
        permadeath: runConfig.permadeath,
      });
      // biome-ignore lint/suspicious/noExplicitAny: clearing bridge
      (window as any).__mmRunConfig = undefined;
    } else {
      startRun(overrideSeed !== undefined ? { seed: overrideSeed } : {});
    }
    startRecording();
    // biome-ignore lint/suspicious/noExplicitAny: dev hook
    (window as any).__mmHonk = () => honk();

    const eRng = eventsRng();
    const balloonSpawner = new BalloonSpawner(eRng);
    const mirrorDuplicator = new MirrorDuplicator(eRng);
    const raidDirector = new RaidDirector(eRng);
    const trickSystem = new TrickSystem();

    // biome-ignore lint/suspicious/noExplicitAny: gimmick systems
    (window as any).__mmBalloonSpawner = balloonSpawner;
    // biome-ignore lint/suspicious/noExplicitAny: gimmick systems
    (window as any).__mmMirrorDuplicator = mirrorDuplicator;
    // biome-ignore lint/suspicious/noExplicitAny: gimmick systems
    (window as any).__mmRaidDirector = raidDirector;
    // biome-ignore lint/suspicious/noExplicitAny: gimmick systems
    (window as any).__mmTrickSystem = trickSystem;

    const unsub = useGameStore.subscribe((s, prev) => {
      if (s.currentZone !== prev.currentZone) audioBus.setZone(s.currentZone);

      if (s.gameOver && !prev.gameOver) {
        const distM = s.distance;
        const crowd = s.crowdReaction;
        const daily = isDailyRoute();
        const today = utcDateString();
        const seed = s.seed || getDailySeed();

        recordRun({ distance: distM, crowd }).catch((err) => reportError(err, 'Game.recordRun'));

        const distCm = Math.round(distM * 100);
        import('drizzle-orm').then(({ sql }) => {
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
            .catch((err: unknown) => reportError(err, 'Game.dailyRuns.upsert'));
        });

        finishAndMaybeSave(distM, crowd, daily).catch((err) =>
          reportError(err, 'Game.finishAndMaybeSave'),
        );
        import('../persistence/db').then(({ persistToOpfs }) =>
          persistToOpfs().catch((err) => reportError(err, 'Game.persistToOpfs')),
        );
      }

      if (s.running && !prev.running) startRecording();
    });

    let rafId = 0;
    function gimmickLoop() {
      const s = useGameStore.getState();
      const now = performance.now();
      if (s.running) {
        sampleFrame(now, s.lateral, s.speedMps, s.steer);
        balloonSpawner.update(s.distance, s.currentZone, now);
        // biome-ignore lint/suspicious/noExplicitAny: obstacle spawner
        const spawner = (window as any).__mmSpawner;
        if (spawner) mirrorDuplicator.sync(spawner.getObstacles(), s.currentZone);
        raidDirector.update(now, s.distance, s.lateral, s.airborne, s.running, {
          onTelegraph: (_kind) => {},
          onHeavyCrash: () => useGameStore.getState().applyCrash(true),
          onLightCrash: () => useGameStore.getState().applyCrash(false),
          onCrowdBonus: (amount) =>
            useGameStore.setState((prev) => ({ crowdReaction: prev.crowdReaction + amount })),
        });
        const isAirborne =
          s.currentPieceKind === 'ramp' ||
          s.currentPieceKind === 'rampLong' ||
          s.currentPieceKind === 'rampLongCurved';
        trickSystem.update(now, isAirborne, {
          onCleanLanding: () => {
            useGameStore.setState((prev) => ({
              sanity: Math.min(100, prev.sanity + 15),
              crowdReaction: prev.crowdReaction + 150,
            }));
          },
          onBotchedLanding: () => useGameStore.getState().applyCrash(false),
        });
        if (isAirborne !== s.airborne) useGameStore.getState().setAirborne(isAirborne);
        const ts = trickSystem.getState();
        useGameStore.getState().setTrickState(ts.currentTrick !== null, ts.rotY, ts.rotZ);
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
    };
  }, [startRun]);
}
