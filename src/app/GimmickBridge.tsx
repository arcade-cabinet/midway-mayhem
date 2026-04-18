/**
 * @module app/GimmickBridge
 *
 * Hosts the singleton gimmick systems that need a per-frame RAF loop but
 * are not yet driven by the main ECS GameLoop (which runs inside <Canvas>).
 * Extracted from the legacy `useGameSystems` hook so the unique logic survives
 * the transition; duplicate responsibilities (RaidDirector, replayRecorder,
 * run-end persistence) are omitted here — they are already owned by
 * RaidBridge, GameLoop, and gameState.endRun respectively.
 *
 * Unique responsibilities owned here:
 *   - BalloonSpawner  — streams balloon-alley anchors + handles collisions
 *   - MirrorDuplicator — syncs obstacle layout for MirrorLayer
 *   - TrickSystem     — ramp airborne detection + trick scoring
 *   - audioBus.setZone — drives conductor phrase changes on zone entry
 *   - Daily runs DB upsert — persists today's best distance
 *
 * Lives OUTSIDE the R3F <Canvas> so it mounts once regardless of Suspense
 * boundaries. The gimmick systems communicate with the canvas via
 * `window.__mmBalloonSpawner` / `__mmMirrorDuplicator` / `__mmTrickSystem`
 * for the components that read them (BalloonLayer, MirrorLayer, etc.).
 */
import { useEffect } from 'react';
import { tunables } from '@/config';
import { audioBus } from '@/audio/audioBus';
import { combo } from '@/game/comboSystem';
import { reportError } from '@/game/errorBus';
import { useGameStore } from '@/game/gameState';
import { BalloonSpawner } from '@/game/obstacles/balloonSpawner';
import { MirrorDuplicator } from '@/game/obstacles/mirrorDuplicator';
import { RampDetect } from '@/game/rampDetect';
import { sampleFrame } from '@/game/replayRecorder';
import { eventsRng } from '@/game/runRngBus';
import { trickInputBus } from '@/game/trickInputBus';
import { TrickSystem } from '@/game/trickSystem';
import { db } from '@/persistence/db';
import { dailyRuns } from '@/persistence/schema';
import { getDailySeed, isDailyRoute, utcDateString } from '@/track/dailyRoute';

export function GimmickBridge(): null {
  useEffect(() => {
    const eRng = eventsRng();
    const balloonSpawner = new BalloonSpawner(eRng);
    const mirrorDuplicator = new MirrorDuplicator(eRng);
    const trickSystem = new TrickSystem();
    const rampDetect = new RampDetect();

    // Expose on window so BalloonLayer + MirrorLayer can read their state
    // without prop-drilling through the render tree.
    // biome-ignore lint/suspicious/noExplicitAny: gimmick bridge window slots
    (window as any).__mmBalloonSpawner = balloonSpawner;
    // biome-ignore lint/suspicious/noExplicitAny: gimmick bridge window slots
    (window as any).__mmMirrorDuplicator = mirrorDuplicator;
    // biome-ignore lint/suspicious/noExplicitAny: gimmick bridge window slots
    (window as any).__mmTrickSystem = trickSystem;
    // biome-ignore lint/suspicious/noExplicitAny: gimmick bridge window slots
    (window as any).__mmRampDetect = rampDetect;

    // ── Zone subscription ────────────────────────────────────────────────────
    // Drive the circus conductor phrases whenever the player crosses a zone
    // boundary. audioBus.setZone() is a no-op until init() completes, so no
    // guard needed here.
    const unsub = useGameStore.subscribe((s, prev) => {
      if (s.currentZone !== prev.currentZone) {
        audioBus.setZone(s.currentZone);
      }

      // ── Daily-runs upsert ────────────────────────────────────────────────
      // gameState.endRun() handles the profile + lifetime-stats write.
      // This upsert is additional: it maintains the per-date leaderboard row.
      if (s.gameOver && !prev.gameOver) {
        const distM = s.distance;
        const crowd = s.crowdReaction;
        const today = utcDateString();
        const seed = s.seed || getDailySeed();
        const distCm = Math.round(distM * 100);
        const daily = isDailyRoute();
        if (daily) {
          import('drizzle-orm')
            .then(({ sql }) => {
              db()
                .insert(dailyRuns)
                .values({
                  dateUtc: today,
                  seed,
                  bestDistanceCm: distCm,
                  bestCrowd: crowd,
                  runCount: 1,
                })
                .onConflictDoUpdate({
                  target: dailyRuns.dateUtc,
                  set: {
                    seed,
                    bestDistanceCm: sql`MAX(${dailyRuns.bestDistanceCm}, excluded.best_distance_cm)`,
                    bestCrowd: sql`MAX(${dailyRuns.bestCrowd}, excluded.best_crowd)`,
                    runCount: sql`${dailyRuns.runCount} + 1`,
                  },
                })
                .catch((err: unknown) => reportError(err, 'GimmickBridge.dailyRuns.upsert'));
            })
            .catch((err: unknown) => reportError(err, 'GimmickBridge.dailyRuns.import'));
        }
      }
    });

    // ── Gimmick RAF loop ─────────────────────────────────────────────────────
    // Drives balloon/mirror/trick systems at display rate. RaidDirector is
    // intentionally omitted here — it is owned by RaidBridge inside <Canvas>.
    let rafId = 0;
    function gimmickLoop() {
      const s = useGameStore.getState();
      const now = performance.now();
      if (s.running) {
        // Balloon alley: update spawner and check for pop collisions
        balloonSpawner.update(s.distance, s.currentZone, now);
        const hitId = balloonSpawner.checkCollision(s.distance, s.lateral, now);
        if (hitId !== null) {
          balloonSpawner.consumeBalloon(hitId);
          useGameStore.setState((prev) => ({ crowdReaction: prev.crowdReaction + 30 }));
        }

        // Mirror layer: keep phantom obstacle positions in sync
        // biome-ignore lint/suspicious/noExplicitAny: obstacle spawner window slot
        const spawner = (window as any).__mmSpawner;
        if (spawner) mirrorDuplicator.sync(spawner.getObstacles(), s.currentZone);

        // Trick system: Y-displacement ramp detect + trick input drain + scoring
        const onRampPiece =
          s.currentPieceKind === 'ramp' ||
          s.currentPieceKind === 'rampLong' ||
          s.currentPieceKind === 'rampLongCurved';
        const isAirborne = rampDetect.update(s.distance, s.speedMps, now) || onRampPiece;

        // Forward any trick inputs queued by keyboard/touch since last frame
        const pendingInputs = trickInputBus.drain();
        for (const input of pendingInputs) {
          trickSystem.pushInput(input, now);
        }

        trickSystem.update(now, isAirborne, {
          onCleanLanding: () => {
            // Reward: base score + per-rotation bonus + combo chain event
            const trickState = trickSystem.getState();
            const rotations = trickState.currentTrick
              ? Math.abs(trickState.currentTrick.totalAngle) / (Math.PI * 2)
              : 1;
            const bonus =
              tunables.tricks.trickScoreBase +
              Math.round(rotations * tunables.tricks.trickScorePerRot);
            useGameStore.setState((prev) => ({
              sanity: Math.min(100, prev.sanity + tunables.tricks.cleanSanityReward),
              crowdReaction:
                prev.crowdReaction + tunables.tricks.cleanCrowdReward + bonus,
            }));
            combo.registerEvent('pickup');
          },
          onBotchedLanding: () => useGameStore.getState().applyCrash(false),
        });
        if (isAirborne !== s.airborne) useGameStore.getState().setAirborne(isAirborne);
        const ts = trickSystem.getState();
        useGameStore.getState().setTrickState(ts.currentTrick !== null, ts.rotY, ts.rotZ);

        // Replay sampler — throttled to ~30 Hz inside sampleFrame itself.
        const speed = s.speedMps;
        const steer = s.steer;
        const lateral = s.lateral;
        sampleFrame(now, lateral, speed, steer);
      }
      rafId = requestAnimationFrame(gimmickLoop);
    }
    gimmickLoop();

    return () => {
      unsub();
      cancelAnimationFrame(rafId);
      // biome-ignore lint/suspicious/noExplicitAny: cleanup window slots
      (window as any).__mmBalloonSpawner = undefined;
      // biome-ignore lint/suspicious/noExplicitAny: cleanup window slots
      (window as any).__mmMirrorDuplicator = undefined;
      // biome-ignore lint/suspicious/noExplicitAny: cleanup window slots
      (window as any).__mmTrickSystem = undefined;
    };
  }, []);

  return null;
}
