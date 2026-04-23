/**
 * Root component. Landing surface + 3D scene + per-frame game loop.
 *
 * The canvas always renders the live cockpit + track scene. The
 * TitleScreen sits on top until the user clicks DRIVE, then fades away.
 * Input listeners + motion loop are mounted unconditionally so the player
 * entity's state always reflects reality; gating is purely visual.
 */
import { Canvas } from '@react-three/fiber';
import { WorldProvider } from 'koota/react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { audioBus } from '@/audio/audioBus';
import { useArcadeAudio } from '@/audio/useArcadeAudio';
import { type EndReason, resetGameOver } from '@/ecs/systems/gameOver';
import { spawnPlayer } from '@/ecs/systems/playerMotion';
import { seedContent } from '@/ecs/systems/seedContent';
import { seedZones } from '@/ecs/systems/seedZones';
import { seedTrack } from '@/ecs/systems/track';
import { Obstacle, Player, Score } from '@/ecs/traits';
import { world } from '@/ecs/world';
import { resetAchievementsRun } from '@/game/achievementRun';
import { DebugCaptureBridge } from '@/game/debugCapture';
import { installDiagnosticsBus, wireDiagnosticsHooks } from '@/game/diagnosticsBus';
import { ensureGameTraits, useGameStore } from '@/game/gameState';
import { commitGhost, resetGhostRecorder } from '@/game/ghost';
import { Governor } from '@/game/governor/Governor';
import { useGameSystems } from '@/game/useGameSystems';
import { useSettings } from '@/hooks/useSettings';
import { haptic } from '@/input/haptics';
import { TouchControls } from '@/input/TouchControls';
import { useKeyboard } from '@/input/useKeyboard';
import { useMouseSteer } from '@/input/useMouseSteer';
import { BoostRush } from '@/render/BoostRush';
import { Cockpit } from '@/render/cockpit/Cockpit';
import { ExplosionFX } from '@/render/cockpit/ExplosionFX';
import { HonkContext } from '@/render/cockpit/HonkContext';
import { RacingLineGhost } from '@/render/cockpit/RacingLineGhost';
import { BigTopEnvironment, isNightFromUrl } from '@/render/Environment';
import { Audience } from '@/render/env/Audience';
import { ZoneProps } from '@/render/env/ZoneProps';
import { BalloonLayer } from '@/render/obstacles/BalloonLayer';
import { BarkerCrowd } from '@/render/obstacles/BarkerCrowd';
import { FireHoopGate } from '@/render/obstacles/FireHoopGate';
import { GhostCar } from '@/render/obstacles/GhostCar';
import { MirrorLayer } from '@/render/obstacles/MirrorLayer';
import { ObstacleSystem } from '@/render/obstacles/ObstacleSystem';
import { RaidBridge } from '@/render/obstacles/RaidBridge';
import { RaidLayer } from '@/render/obstacles/RaidLayer';
import { PostFX } from '@/render/PostFX';
import { SpeedLines } from '@/render/SpeedLines';
import { Track } from '@/render/Track';
import { TrackContent } from '@/render/TrackContent';
import { FinishBanner } from '@/render/track/FinishBanner';
import { StartPlatform } from '@/render/track/StartPlatform';
import { TrackScroller } from '@/render/track/TrackScroller';
import { ZoneBanners } from '@/render/ZoneBanners';
import { saveScore } from '@/storage/scores';
import { initDailyRouteFromUrl } from '@/track/dailyRoute';
import { AchievementToasts } from '@/ui/AchievementToasts';
import { GameOverOverlay } from '@/ui/GameOverOverlay';
import { ErrorModal } from '@/ui/hud/ErrorModal';
import { HUD } from '@/ui/hud/HUD';
import { LiveRegion } from '@/ui/hud/LiveRegion';
import { PauseButton } from '@/ui/hud/PauseButton';
import { PauseOverlay } from '@/ui/hud/PauseOverlay';
import { ReactErrorBoundary } from '@/ui/hud/ReactErrorBoundary';
import type { NewRunConfig } from '@/ui/title/NewRunModal';
import { TitleScreen } from '@/ui/title/TitleScreen';
import { GameLoop } from './GameLoop';

// Seed the world once at module load. ES modules are evaluated exactly
// once per process, so this block runs only once even with React StrictMode
// double-invoking child components — no guard flag needed.
initDailyRouteFromUrl();
seedTrack(world, 42);
seedContent(world, 42);
seedZones(world);
spawnPlayer(world);
// Attach all run-state traits to the player entity now that it is spawned.
ensureGameTraits(world);
resetAchievementsRun();
resetGhostRecorder();
// Install window.__mm.diag() etc for dev tooling.
installDiagnosticsBus();
// Wire __mmStartRun / __mmGetState / etc so the diag bus can read real state.
wireDiagnosticsHooks({
  getState: () => useGameStore.getState(),
  setSteer: (v) => useGameStore.getState().setSteer(v),
  startRun: () => useGameStore.getState().startRun({ seed: 42, difficulty: 'plenty' }),
  endRun: () => useGameStore.getState().endRun(),
  applyCrash: (heavy) => useGameStore.getState().applyCrash(heavy),
  applyPickup: (kind) => useGameStore.getState().applyPickup(kind),
  pause: () => useGameStore.getState().pause(),
  resume: () => useGameStore.getState().resume(),
  getObstacles: () => {
    const out: Array<Record<string, number | string | boolean>> = [];
    world.query(Obstacle).updateEach(([ob]) => {
      out.push({
        kind: ob.kind,
        distance: ob.distance,
        lateral: ob.lateral,
        consumed: ob.consumed,
      });
    });
    return out;
  },
});

/** URL flag: `?preserve=1` opts into `gl.preserveDrawingBuffer: true`,
 * which is needed by the vitest-browser tests that call
 * `canvas.toDataURL()` directly (MidRunVisualBaseline, etc). In prod
 * and CI E2E it stays off — the preserved buffer forces a ReadPixels
 * on every frame which tanks performance on swiftshader. */
function preserveDrawingBufferFromUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('preserve') === '1';
}

function AudioBridge({
  active,
  onReady,
}: {
  active: boolean;
  onReady: (fns: { honk: () => void; ding: () => void; thud: () => void }) => void;
}) {
  const api = useArcadeAudio(world, active);
  onReady(api);
  return null;
}

export function App() {
  const [titleVisible, setTitleVisible] = useState(true);
  const [endReason, setEndReason] = useState<EndReason | null>(null);
  const playing = !titleVisible && endReason === null;
  const hornRef = useRef<() => void>(() => {});
  const dingRef = useRef<() => void>(() => {});
  const thudRef = useRef<() => void>(() => {});
  const settings = useSettings();
  // Night mode: either the URL flag OR the persisted setting forces it.
  const night = isNightFromUrl() || (settings?.nightMode ?? false);

  useKeyboard({ world, enabled: playing, onHorn: () => hornRef.current() });
  useMouseSteer({ world, enabled: playing });
  useGameSystems();

  // R3F v9's useMeasure hook on the Canvas wrapper occasionally doesn't
  // fire its initial callback when the wrapper is already laid out at
  // subscribe time, leaving the three.js scene at size {0,0} — the
  // canvas stays blank even though DOM mount succeeded. Dispatching a
  // window-resize after mount forces R3F to re-measure and create its
  // render root. Guarded integration test: src/app/App.browser.test.tsx.
  useEffect(() => {
    const id = setTimeout(() => window.dispatchEvent(new Event('resize')), 0);
    return () => clearTimeout(id);
  }, []);

  return (
    <ReactErrorBoundary context="App.root">
      <WorldProvider world={world}>
        <div
          data-testid="mm-app"
          style={{ position: 'fixed', inset: 0, background: '#0b0f1a', overflow: 'hidden' }}
        >
          <ErrorModal />
          <LiveRegion />
          <Canvas
            // preserveDrawingBuffer forces a ReadPixels on every frame which
            // stalls the GPU pipeline — catastrophic on swiftshader CI
            // runners (observed: autoplay frame rate dropping to ~1 FPS and
            // distance never incrementing past 0). PhotoMode + debugCapture
            // re-render synchronously before calling toDataURL instead of
            // relying on a preserved buffer, so we don't need this flag in
            // prod. It IS still needed by the vitest-browser visual-baseline
            // tests that call `canvas.toDataURL()` after a wait — those tests
            // set `?preserve=1` on the URL to opt back in.
            gl={{ antialias: true, preserveDrawingBuffer: preserveDrawingBufferFromUrl() }}
            frameloop="always"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          >
            <color attach="background" args={['#0b0f1a']} />
            <ambientLight intensity={0.45} color="#ffd6a8" />
            <directionalLight position={[50, 100, 40]} intensity={1.3} color="#fff1db" />
            <Suspense fallback={null}>
              <BigTopEnvironment night={night} />
              {/* Crowd silhouettes — world-static, outside TrackScroller */}
              <Audience />
              <ZoneProps />
            </Suspense>
            <TrackScroller>
              <Track />
              <TrackContent />
              <ObstacleSystem />
              <StartPlatform />
              <FinishBanner />
              <BalloonLayer />
              <MirrorLayer />
              <FireHoopGate />
              <BarkerCrowd />
              <ZoneBanners />
              <GhostCar />
              <RacingLineGhost />
            </TrackScroller>
            <RaidBridge />
            <RaidLayer />
            <HonkContext.Provider value={() => hornRef.current()}>
              <Cockpit />
            </HonkContext.Provider>
            {/* Clown explosion on game-over — confetti, hearts, stars, flash.
              Self-triggers from the store's gameOver flag; no prop wiring. */}
            <ExplosionFX />
            <SpeedLines />
            <BoostRush />
            <PostFX />
            <GameLoop
              world={world}
              active={playing}
              onPickup={(kind) => {
                dingRef.current();
                if (kind === 'balloon') void haptic('light');
                else if (kind === 'mega') void haptic('heavy');
                else void haptic('medium');
              }}
              onObstacle={(kind) => {
                thudRef.current();
                // Route crash through the new 3-bus audioBus so the hard-duck
                // (PRQ C1) fires and the crash stinger plays through the sfxBus.
                // heavy = true for everything except the gentle oil-slick graze.
                audioBus.playCrash(0, kind !== 'oil');
                // Oil slicks feel wobbly, not crashy; everything else thuds.
                if (kind === 'oil') void haptic('medium');
                else void haptic('heavy');
              }}
              onEnd={(r) => {
                setEndReason(r);
                const score = world.query(Player, Score)[0]?.get(Score);
                if (score) {
                  void saveScore({
                    score: score.value,
                    balloons: score.balloons,
                    seed: 42,
                    timestamp: Date.now(),
                  });
                }
                commitGhost(world);
              }}
            />
            <AudioBridge
              active={playing}
              onReady={(fns) => {
                hornRef.current = fns.honk;
                dingRef.current = fns.ding;
                thudRef.current = fns.thud;
              }}
            />
            {/* Autonomous driver — active when ?governor=1 or ?autoplay=1 */}
            <Governor />
            {/* Debug frame capture — active in DEV or ?diag=1 */}
            <DebugCaptureBridge />
          </Canvas>
          {titleVisible ? (
            <TitleScreen
              onStart={(config?: NewRunConfig) => {
                // Start the run — sets RunSession.running=true, initializes
                // the run RNG + optimal path + combo + difficulty profile.
                const store = useGameStore.getState();
                if (config) {
                  store.startRun({
                    seed: config.seed,
                    difficulty: config.difficulty,
                    seedPhrase: config.seedPhrase,
                    permadeath: config.permadeath,
                  });
                } else {
                  // Autoplay-without-config path (keyboard fallback).
                  store.startRun({ seed: 42, difficulty: 'plenty' });
                }
                setTitleVisible(false);
              }}
            />
          ) : (
            <>
              <HUD />
              <PauseButton />
              <TouchControls world={world} enabled={playing} onHorn={() => hornRef.current()} />
            </>
          )}
          <PauseOverlay />
          <AchievementToasts />
          {endReason !== null ? (
            <GameOverEnd
              reason={endReason}
              onRestart={() => {
                // Simplest reliable reset: hard reload.
                resetGameOver();
                window.location.reload();
              }}
            />
          ) : null}
        </div>
      </WorldProvider>
    </ReactErrorBoundary>
  );
}

function GameOverEnd({ reason, onRestart }: { reason: EndReason; onRestart: () => void }) {
  const score = world.query(Player, Score)[0]?.get(Score);
  return (
    <GameOverOverlay
      reason={reason}
      score={score?.value ?? 0}
      balloons={score?.balloons ?? 0}
      onRestart={onRestart}
    />
  );
}
