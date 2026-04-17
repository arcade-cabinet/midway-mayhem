/**
 * Root component. Landing surface + 3D scene + per-frame game loop.
 *
 * The canvas always renders the live cockpit + track scene. The
 * TitleScreen sits on top until the user clicks DRIVE, then fades away.
 * Input listeners + motion loop are mounted unconditionally so the player
 * entity's state always reflects reality; gating is purely visual.
 */
import { Canvas, useFrame } from '@react-three/fiber';
import { WorldProvider } from 'koota/react';
import { Suspense, useRef, useState } from 'react';
import { useArcadeAudio } from '@/audio/useArcadeAudio';
import { type EndReason, resetGameOver, stepGameOver } from '@/ecs/systems/gameOver';
import { spawnPlayer } from '@/ecs/systems/playerMotion';
import { seedContent } from '@/ecs/systems/seedContent';
import { seedTrack } from '@/ecs/systems/track';
import { usePlayerLoop } from '@/ecs/systems/usePlayerLoop';
import { seedZones } from '@/ecs/systems/seedZones';
import { resetAchievementsRun, stepAchievements } from '@/game/achievements';
import { AchievementToasts } from '@/ui/AchievementToasts';
import { ZoneBanners } from '@/render/ZoneBanners';
import { Player, Score } from '@/ecs/traits';
import { world } from '@/ecs/world';
import { haptic } from '@/input/haptics';
import { TouchControls } from '@/input/TouchControls';
import { useKeyboard } from '@/input/useKeyboard';
import { Cockpit } from '@/render/cockpit/Cockpit';
import { BigTopEnvironment, isNightFromUrl } from '@/render/Environment';
import { PostFX } from '@/render/PostFX';
import { BoostRush } from '@/render/BoostRush';
import { SpeedLines } from '@/render/SpeedLines';
import { Track } from '@/render/Track';
import { TrackContent } from '@/render/TrackContent';
import { saveScore } from '@/storage/scores';
import { GameOverOverlay } from '@/ui/GameOverOverlay';
import { TitleScreen } from '@/ui/TitleScreen';

// Seed the world once at module load. ES modules are evaluated exactly
// once per process, so this block runs only once even with React StrictMode
// double-invoking child components — no guard flag needed.
seedTrack(world, 42);
seedContent(world, 42);
seedZones(world);
spawnPlayer(world);
resetAchievementsRun();

function GameLoop({
  active,
  onPickup,
  onObstacle,
  onEnd,
}: {
  active: boolean;
  onPickup: (kind: 'balloon' | 'boost') => void;
  onObstacle: (kind: 'cone' | 'oil') => void;
  onEnd: (reason: EndReason) => void;
}) {
  usePlayerLoop(world, active, { onPickup, onObstacle });
  useFrame(() => {
    if (!active) return;
    stepGameOver(world, { onEnd });
    stepAchievements(world);
  });
  return null;
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

  useKeyboard({ world, enabled: playing, onHorn: () => hornRef.current() });

  return (
    <WorldProvider world={world}>
      <div
        data-testid="mm-app"
        style={{ position: 'fixed', inset: 0, background: '#0b0f1a', overflow: 'hidden' }}
      >
        <Canvas
          gl={{ antialias: true, preserveDrawingBuffer: true }}
          frameloop="always"
          style={{ position: 'absolute', inset: 0 }}
        >
          <color attach="background" args={['#0b0f1a']} />
          <ambientLight intensity={0.45} color="#ffd6a8" />
          <directionalLight position={[50, 100, 40]} intensity={1.3} color="#fff1db" />
          <Suspense fallback={null}>
            <BigTopEnvironment night={isNightFromUrl()} />
          </Suspense>
          <Track />
          <TrackContent />
          <ZoneBanners />
          <Cockpit />
          <SpeedLines />
          <BoostRush />
          <PostFX />
          <GameLoop
            active={playing}
            onPickup={(kind) => {
              if (kind === 'balloon') {
                dingRef.current();
                void haptic('light');
              } else {
                dingRef.current();
                void haptic('medium');
              }
            }}
            onObstacle={() => {
              thudRef.current();
              void haptic('heavy');
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
        </Canvas>
        {titleVisible ? (
          <TitleScreen onDrive={() => setTitleVisible(false)} />
        ) : (
          <TouchControls world={world} enabled={playing} onHorn={() => hornRef.current()} />
        )}
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
