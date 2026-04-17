/**
 * Root component. Landing surface + 3D scene.
 *
 * The canvas always renders the live cockpit + track scene (no gated
 * dev/game split — you're in the car from the first paint). The
 * TitleScreen overlay sits on top until the user clicks DRIVE, then fades
 * away. Pure composition — all game state lives in the koota world, all
 * rendering in src/render/.
 */
import { Canvas } from '@react-three/fiber';
import { WorldProvider } from 'koota/react';
import { Suspense, useState } from 'react';
import { seedTrack } from '@/ecs/systems/track';
import { world } from '@/ecs/world';
import { Cockpit } from '@/render/cockpit/Cockpit';
import { BigTopEnvironment } from '@/render/Environment';
import { Track } from '@/render/Track';
import { TitleScreen } from '@/ui/TitleScreen';

let seeded = false;
if (!seeded) {
  seedTrack(world, 42);
  seeded = true;
}

export function App() {
  const [titleVisible, setTitleVisible] = useState(true);

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
        </Canvas>
        {titleVisible ? <TitleScreen onDrive={() => setTitleVisible(false)} /> : null}
      </div>
    </WorldProvider>
  );
}
