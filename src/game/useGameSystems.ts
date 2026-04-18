/**
 * @module game/useGameSystems
 *
 * Hub for the gimmick singletons that must persist across a run: BalloonSpawner,
 * MirrorDuplicator, RaidDirector, TrickSystem, RampDetect. Subscribes to the
 * game store to flush daily-runs + OPFS on game-over, and runs a RAF loop that
 * ticks the gimmicks while the run is live.
 *
 * Run-lifecycle (startRun / endRun / run config) is handled by TitleScreen ->
 * useGameStore directly. This hook only consumes run state; it never starts one.
 */
import { useEffect } from 'react';
import { audioBus } from '@/audio/audioBus';
import { honk } from '@/audio/honkBus';
import { tireSqueal } from '@/audio/tireSqueal';
import { tunables } from '@/config';
import { combo } from '@/game/comboSystem';
import { reportError } from '@/game/errorBus';
import { useGameStore } from '@/game/gameState';
import { BalloonSpawner } from '@/game/obstacles/balloonSpawner';
import { MirrorDuplicator } from '@/game/obstacles/mirrorDuplicator';
import { RaidDirector } from '@/game/obstacles/raidDirector';
import { RampDetect } from '@/game/rampDetect';
import { eventsRng } from '@/game/runRngBus';
import { trickInputBus } from '@/game/trickInputBus';
import { TrickSystem } from '@/game/trickSystem';
import { db } from '@/persistence/db';
import { dailyRuns } from '@/persistence/schema';
import { getDailySeed, isDailyRoute, utcDateString } from '@/track/dailyRoute';

export function useGameSystems(): void {
  useEffect(() => {
    // biome-ignore lint/suspicious/noExplicitAny: dev hook
    (window as any).__mmHonk = () => honk();

    const eRng = eventsRng();
    const balloonSpawner = new BalloonSpawner(eRng);
    const mirrorDuplicator = new MirrorDuplicator(eRng);
    const raidDirector = new RaidDirector(eRng);
    const trickSystem = new TrickSystem();
    const rampDetect = new RampDetect();

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

      if (s.gameOver && !prev.gameOver && isDailyRoute()) {
        const today = utcDateString();
        const seed = s.seed || getDailySeed();
        const distCm = Math.round(s.distance * 100);
        const crowd = s.crowdReaction;
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
            .catch((err: unknown) => reportError(err, 'useGameSystems.dailyRuns.upsert'));
        });
        import('@/persistence/db').then(({ persistToOpfs }) =>
          persistToOpfs().catch((err: unknown) => reportError(err, 'useGameSystems.persistToOpfs')),
        );
      }
    });

    let rafId = 0;
    function gimmickLoop() {
      const s = useGameStore.getState();
      const now = performance.now();
      if (s.running) {
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
        const onRampPiece =
          s.currentPieceKind === 'ramp' ||
          s.currentPieceKind === 'rampLong' ||
          s.currentPieceKind === 'rampLongCurved';
        const isAirborne = rampDetect.update(s.distance, s.speedMps, now) || onRampPiece;
        for (const input of trickInputBus.drain()) {
          trickSystem.pushInput(input, now);
        }
        trickSystem.update(now, isAirborne, {
          onCleanLanding: () => {
            const trickState = trickSystem.getState();
            const rotations = trickState.currentTrick
              ? Math.abs(trickState.currentTrick.totalAngle) / (Math.PI * 2)
              : 1;
            const tk = tunables.tricks;
            const bonus = tk.trickScoreBase + Math.round(rotations * tk.trickScorePerRot);
            useGameStore.setState((prev) => ({
              sanity: Math.min(100, prev.sanity + tk.cleanSanityReward),
              crowdReaction: prev.crowdReaction + tk.cleanCrowdReward + bonus,
            }));
            combo.registerEvent('pickup');
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
  }, []);
}
