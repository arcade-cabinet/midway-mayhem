import { Environment } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { assetUrl } from '@/assets/manifest';
import { audioBus, honk } from '@/audio';
import { tireSqueal } from '@/audio/tireSqueal';
import { Cockpit } from '@/cockpit/Cockpit';
import { ExplosionFX } from '@/cockpit/ExplosionFX';
import { RacingLineGhost } from '@/cockpit/RacingLineGhost';
import { reportError } from '@/game/errorBus';
import { useGameStore } from '@/game/gameState';
import { Governor } from '@/game/governor/Governor';
import { finishAndMaybeSave, sampleFrame, startRecording } from '@/game/replayRecorder';
import { eventsRng } from '@/game/runRngBus';
import { TrickSystem } from '@/game/trickSystem';
import { useKeyboardControls } from '@/hooks/useKeyboardControls';
import { useSteering } from '@/hooks/useSteering';
import { useTouchGestures } from '@/hooks/useTouchGestures';
import { HUD } from '@/hud/HUD';
import { LiveRegion } from '@/hud/LiveRegion';
import {
  PhotoModeControls,
  PhotoModeDownloadCapture,
  PhotoModeOverlay,
  triggerDownload,
} from '@/hud/PhotoMode';
import { ReactErrorBoundary } from '@/hud/ReactErrorBoundary';
import { ZoneBanner } from '@/hud/ZoneBanner';
import { BalloonLayer } from '@/obstacles/BalloonLayer';
import { BarkerCrowd } from '@/obstacles/BarkerCrowd';
import { BalloonSpawner } from '@/obstacles/balloonSpawner';
import { FireHoopGate } from '@/obstacles/FireHoopGate';
import { GhostCar } from '@/obstacles/GhostCar';
import { MirrorLayer } from '@/obstacles/MirrorLayer';
import { MirrorDuplicator } from '@/obstacles/mirrorDuplicator';
import { ObstacleSystem } from '@/obstacles/ObstacleSystem';
import { PickupSystem } from '@/obstacles/PickupSystem';
import { RaidLayer } from '@/obstacles/RaidLayer';
import { RaidDirector } from '@/obstacles/raidDirector';
import { db } from '@/persistence/db';
import { recordRun } from '@/persistence/profile';
import { dailyRuns } from '@/persistence/schema';
import { getDailySeed, isDailyRoute, utcDateString } from '@/track/dailyRoute';
import { FinishBanner } from '@/track/FinishBanner';
import { StartPlatform } from '@/track/StartPlatform';
import { TrackSystem } from '@/track/TrackSystem';
import { WorldScroller } from '@/track/WorldScroller';
import { GameLoop } from './GameLoop';
import { PostFX } from './PostFX';

export function Game() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLCanvasElement | null>(null);
  const startRun = useGameStore((s) => s.startRun);
  const photoMode = useGameStore((s) => s.photoMode);

  // Feature A + B + C: singleton systems exposed on window for components
  const balloonSpawnerRef = useRef<BalloonSpawner | null>(null);
  const mirrorDuplicatorRef = useRef<MirrorDuplicator | null>(null);
  const raidDirectorRef = useRef<RaidDirector | null>(null);
  const trickSystemRef = useRef<TrickSystem | null>(null);

  useEffect(() => {
    // Pick up deterministic seed from URL ?seed=N hook (set by App.tsx bootstrap)
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
      // Clear after consuming so a back-to-title-then-new run doesn't replay stale config.
      // biome-ignore lint/suspicious/noExplicitAny: clearing bridge
      (window as any).__mmRunConfig = undefined;
    } else {
      startRun(overrideSeed !== undefined ? { seed: overrideSeed } : {});
    }
    startRecording();
    // biome-ignore lint/suspicious/noExplicitAny: dev hook
    (window as any).__mmHonk = () => honk();

    // Initialize feature systems. Every streaming in-run spawner/director
    // shares ONE events channel — burning entropy in one does not desync the
    // others relative to the master seed, because they cooperatively advance
    // the same generator and replay runs in the same order.
    const eRng = eventsRng();
    const rng = eRng;
    const balloonSpawner = new BalloonSpawner(eRng);
    const mirrorDuplicator = new MirrorDuplicator(eRng);
    const raidDirector = new RaidDirector(eRng);
    const trickSystem = new TrickSystem();

    balloonSpawnerRef.current = balloonSpawner;
    mirrorDuplicatorRef.current = mirrorDuplicator;
    raidDirectorRef.current = raidDirector;
    trickSystemRef.current = trickSystem;

    // Expose on window for components to consume
    // biome-ignore lint/suspicious/noExplicitAny: gimmick systems
    (window as any).__mmBalloonSpawner = balloonSpawner;
    // biome-ignore lint/suspicious/noExplicitAny: gimmick systems
    (window as any).__mmMirrorDuplicator = mirrorDuplicator;
    // biome-ignore lint/suspicious/noExplicitAny: gimmick systems
    (window as any).__mmRaidDirector = raidDirector;
    // biome-ignore lint/suspicious/noExplicitAny: gimmick systems
    (window as any).__mmTrickSystem = trickSystem;

    void rng; // suppress unused warning

    // Drive the procedural conductor's zone key+arrangement from gameState
    const unsub = useGameStore.subscribe((s, prev) => {
      if (s.currentZone !== prev.currentZone) audioBus.setZone(s.currentZone);

      // On game-over: persist stats + finalize replay
      if (s.gameOver && !prev.gameOver) {
        const distM = s.distance;
        const crowd = s.crowdReaction;
        const daily = isDailyRoute();
        const today = utcDateString();
        // Prefer the actual run seed (from the NewRunModal); fall back to the
        // daily seed only for legacy runs that don't have a seed set.
        const seed = s.seed || getDailySeed();

        // Record to profile stats (always)
        recordRun({ distance: distM, crowd }).catch((err) => reportError(err, 'Game.recordRun'));

        // Record to daily_runs table (always, even in practice). Use drizzle's
        // onConflictDoUpdate for atomic upsert — cleaner than raw SQL and
        // keeps us inside the type-safe query surface.
        const distCm = Math.round(distM * 100);
        import('drizzle-orm').then(({ sql }) => {
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
            .catch((err: unknown) => reportError(err, 'Game.dailyRuns.upsert'));
        });

        // Finalize replay (only saves if beats best and daily mode)
        finishAndMaybeSave(distM, crowd, daily).catch((err) =>
          reportError(err, 'Game.finishAndMaybeSave'),
        );

        // Persist OPFS snapshot after writes
        import('../persistence/db').then(({ persistToOpfs }) =>
          persistToOpfs().catch((err) => reportError(err, 'Game.persistToOpfs')),
        );
      }

      // On new run start: start recording
      if (s.running && !prev.running) {
        startRecording();
      }
    });

    // Per-frame update loop for feature systems (runs outside R3F)
    let rafId = 0;
    function gimmickLoop() {
      const s = useGameStore.getState();
      const now = performance.now();
      if (s.running) {
        // Sample state for replay ghost
        sampleFrame(now, s.lateral, s.speedMps, s.steer);

        balloonSpawner.update(s.distance, s.currentZone, now);

        // Sync mirror duplicator with current obstacles
        // biome-ignore lint/suspicious/noExplicitAny: obstacle spawner
        const spawner = (window as any).__mmSpawner;
        if (spawner) {
          mirrorDuplicator.sync(spawner.getObstacles(), s.currentZone);
        }

        // Raid director
        raidDirector.update(now, s.distance, s.lateral, s.airborne, s.running, {
          onTelegraph: (_kind) => {
            // Could trigger a banner — raid HUD handles this
          },
          onHeavyCrash: () => useGameStore.getState().applyCrash(true),
          onLightCrash: () => useGameStore.getState().applyCrash(false),
          onCrowdBonus: (amount) =>
            useGameStore.setState((prev) => ({ crowdReaction: prev.crowdReaction + amount })),
        });

        // Trick system: detect airborne from currentPieceKind (ramp pieces)
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

        // Sync airborne state back to game store
        if (isAirborne !== s.airborne) {
          useGameStore.getState().setAirborne(isAirborne);
        }
        const ts = trickSystem.getState();
        useGameStore.getState().setTrickState(ts.currentTrick !== null, ts.rotY, ts.rotZ);

        // Balloon pickup collection
        const hitId = balloonSpawner.checkCollision(s.distance, s.lateral, now);
        if (hitId !== null) {
          balloonSpawner.consumeBalloon(hitId);
          useGameStore.setState((prev) => ({ crowdReaction: prev.crowdReaction + 30 }));
        }
      }
      rafId = requestAnimationFrame(gimmickLoop);
    }
    gimmickLoop();

    // Tire squeal — subscribes to steer from gameStore
    const unsubSqueal = tireSqueal.subscribe();

    return () => {
      unsub();
      unsubSqueal();
      cancelAnimationFrame(rafId);
    };
  }, [startRun]);

  useSteering(canvasEl);
  useKeyboardControls();
  useTouchGestures(canvasEl);

  return (
    <div ref={wrapperRef} data-testid="mm-game" style={{ position: 'absolute', inset: 0 }}>
      <Canvas
        onCreated={({ gl, scene }) => {
          setCanvasEl(gl.domElement);
          scene.fog = new THREE.FogExp2(0x140820, 0.008);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.15;
        }}
        shadows={false}
        dpr={[1, 2]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
      >
        <ReactErrorBoundary context="canvas-root">
          <Suspense fallback={null}>
            {/* Immersive big-top HDRI — the dome surrounding the whole world */}
            <Environment
              files={assetUrl('hdri:circus_arena')}
              background={true}
              environmentIntensity={0.55}
              environmentRotation={[0, Math.PI * 0.25, 0]}
            />
            <ambientLight intensity={0.45} color="#ffd6a8" />

            <GameLoop />

            {/* WORLD — scrolls past the fixed cockpit at origin */}
            <WorldScroller>
              <TrackSystem />
              <StartPlatform />
              <FinishBanner />
              <ObstacleSystem />
              <PickupSystem />
              {/* Feature A: Zone gimmick layers */}
              <BalloonLayer />
              <FireHoopGate />
              <MirrorLayer />
              <BarkerCrowd />
              {/* Feature B: Raid entities */}
              <RaidLayer />
              {/* Ghost car replay for daily route */}
              <GhostCar />
              {/* Racing-line ghost: optimal lateral guide ahead of player */}
              <RacingLineGhost />
            </WorldScroller>

            {/* COCKPIT — world-origin, camera inside */}
            <Cockpit />

            {/* Clown explosion on game-over */}
            <ExplosionFX />

            <Governor />
            <PostFX />
            {/* Photo mode: orbit controls + PNG capture wired into canvas */}
            {photoMode && <PhotoModeControls />}
            {photoMode && (
              <PhotoModeDownloadCapture onCapture={(dataUrl) => triggerDownload(dataUrl)} />
            )}
          </Suspense>
        </ReactErrorBoundary>
      </Canvas>
      <HUD />
      <ZoneBanner />
      <LiveRegion />
      {photoMode && <PhotoModeOverlay />}
    </div>
  );
}
