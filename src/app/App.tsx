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
import { Suspense, useState } from 'react';
import { seedTrack } from '@/ecs/systems/track';
import { spawnPlayer } from '@/ecs/systems/playerMotion';
import { usePlayerLoop } from '@/ecs/systems/usePlayerLoop';
import { world } from '@/ecs/world';
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

export function App() {
  const [titleVisible, setTitleVisible] = useState(true);
  const playing = !titleVisible;

  useKeyboard({ world, enabled: playing });

  return (
    <WorldProvider world={world}>
      <div
        data-testid="mm-app"
        style={{ position: 'fixed', inset: 0, background: '#0b0f1a', overflow: 'hidden' }}
      >
        <Canvas
          gl={{ antialias: true, preserveDrawingBuffer: false }}
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
        </Canvas>
        {titleVisible ? <TitleScreen onDrive={() => setTitleVisible(false)} /> : null}
      </div>
    </WorldProvider>
  );
}
