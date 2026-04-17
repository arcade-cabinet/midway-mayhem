import { Environment } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { assetUrl } from '@/assets/manifest';
import { useSteering } from '@/hooks/useSteering';
import { audioBus, honk } from '@/audio';
import { getDailySeed, isDailyRoute, utcDateString } from '@/track/dailyRoute';
import { db } from '@/persistence/db';
import { dailyRuns } from '@/persistence/schema';
import { recordRun } from '@/persistence/profile';
import { finishAndMaybeSave, sampleFrame, startRecording } from '@/game/replayRecorder';
import { reportError } from '@/game/errorBus';
import { BalloonSpawner } from '@/obstacles/balloonSpawner';
import { MirrorDuplicator } from '@/obstacles/mirrorDuplicator';
import { RaidDirector } from '@/obstacles/raidDirector';
import { TrickSystem } from '@/game/trickSystem';
import { useGameStore } from '@/game/gameState';
import { Governor } from '@/game/governor/Governor';
import { tireSqueal } from '@/audio/tireSqueal';
import { createRng } from '@/utils/rng';
import { GhostCar } from '@/obstacles/GhostCar';
import { PhotoModeControls, PhotoModeDownloadCapture, PhotoModeOverlay, triggerDownload } from '@/hud/PhotoMode';
import { BarkerCrowd } from '@/obstacles/BarkerCrowd';
import { BalloonLayer } from '@/obstacles/BalloonLayer';
import { Cockpit } from '@/cockpit/Cockpit';
import { ExplosionFX } from '@/cockpit/ExplosionFX';
import { FireHoopGate } from '@/obstacles/FireHoopGate';
import { GameLoop } from './GameLoop';
import { HUD } from '@/hud/HUD';
import { MirrorLayer } from '@/obstacles/MirrorLayer';
import { ObstacleSystem } from '@/obstacles/ObstacleSystem';
import { PickupSystem } from '@/obstacles/PickupSystem';
import { PostFX } from './PostFX';
import { RaidLayer } from '@/obstacles/RaidLayer';
import { ReactErrorBoundary } from '@/hud/ReactErrorBoundary';
import { TrackSystem } from '@/track/TrackSystem';
import { WorldScroller } from '@/track/WorldScroller';
import { ZoneBanner } from '@/hud/ZoneBanner';

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
    startRun();
    startRecording();
    // biome-ignore lint/suspicious/noExplicitAny: dev hook
    (window as any).__mmHonk = () => honk();

    // Initialize feature systems
    const seed = useGameStore.getState().seed || 1;
    const rng = createRng(seed);
    const balloonSpawner = new BalloonSpawner(createRng(seed + 1));
    const mirrorDuplicator = new MirrorDuplicator(createRng(seed + 2));
    const raidDirector = new RaidDirector(createRng(seed + 3));
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
        const seed = getDailySeed();

        // Record to profile stats (always)
        recordRun({ distance: distM, crowd }).catch((err) =>
          reportError(err, 'Game.recordRun'),
        );

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
        raidDirector.update(
          now,
          s.distance,
          s.lateral,
          s.airborne,
          s.running,
          {
            onTelegraph: (_kind) => {
              // Could trigger a banner — raid HUD handles this
            },
            onHeavyCrash: () => useGameStore.getState().applyCrash(true),
            onLightCrash: () => useGameStore.getState().applyCrash(false),
            onCrowdBonus: (amount) =>
              useGameStore.setState((prev) => ({ crowdReaction: prev.crowdReaction + amount })),
          },
        );

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
        useGameStore.getState().setTrickState(
          ts.currentTrick !== null,
          ts.rotY,
          ts.rotZ,
        );

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
              <PhotoModeDownloadCapture
                onCapture={(dataUrl) => triggerDownload(dataUrl)}
              />
            )}
          </Suspense>
        </ReactErrorBoundary>
      </Canvas>
      <HUD />
      <ZoneBanner />
      {photoMode && <PhotoModeOverlay />}
    </div>
  );
}
