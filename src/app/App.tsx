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
import { Suspense, useRef, useState } from 'react';
import { useArcadeAudio } from '@/audio/useArcadeAudio';
import { seedTrack } from '@/ecs/systems/track';
import { spawnPlayer } from '@/ecs/systems/playerMotion';
import { usePlayerLoop } from '@/ecs/systems/usePlayerLoop';
import { world } from '@/ecs/world';
import { TouchControls } from '@/input/TouchControls';
import { useKeyboard } from '@/input/useKeyboard';
import { Cockpit } from '@/render/cockpit/Cockpit';
import { BigTopEnvironment } from '@/render/Environment';
import { Track } from '@/render/Track';
import { TitleScreen } from '@/ui/TitleScreen';

let bootstrapped = false;
if (!bootstrapped) {
  seedTrack(world, 42);
  spawnPlayer(world);
  bootstrapped = true;
}

function GameLoop({ active }: { active: boolean }) {
  usePlayerLoop(world, active);
  return null;
}

function AudioBridge({ active, onHornReady }: { active: boolean; onHornReady: (fn: () => void) => void }) {
  const { honk } = useArcadeAudio(world, active);
  // Pass the honk function up so the keyboard hook (mounted outside the
  // Canvas) can trigger it.
  onHornReady(honk);
  return null;
}

export function App() {
  const [titleVisible, setTitleVisible] = useState(true);
  const playing = !titleVisible;
  const hornRef = useRef<() => void>(() => {});

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
            <BigTopEnvironment />
          </Suspense>
          <Track />
          <Cockpit />
          <GameLoop active={playing} />
          <AudioBridge
            active={playing}
            onHornReady={(fn) => {
              hornRef.current = fn;
            }}
          />
        </Canvas>
        {titleVisible ? (
          <TitleScreen onDrive={() => setTitleVisible(false)} />
        ) : (
          <TouchControls world={world} enabled={playing} onHorn={() => hornRef.current()} />
        )}
      </div>
    </WorldProvider>
  );
}
