/**
 * Root component. Pure composition — all state lives in the koota world
 * (src/ecs/), all rendering in src/render/.
 */
import { Canvas } from '@react-three/fiber';
import { WorldProvider } from 'koota/react';
import { seedTrack } from '@/ecs/systems/track';
import { world } from '@/ecs/world';
import { Track } from '@/render/Track';

// Seed the track into the world on module load. Deterministic + idempotent
// via koota's entity model; StrictMode double-invocation would create
// duplicates so we guard via a module-scoped flag.
let seeded = false;
if (!seeded) {
  seedTrack(world, 42);
  seeded = true;
}

export function App() {
  return (
    <WorldProvider world={world}>
      <div
        data-testid="mm-app"
        style={{ width: '100vw', height: '100vh', background: '#0b0f1a' }}
      >
        <Canvas
          camera={{ position: [0, 4, 14], fov: 70, near: 0.1, far: 2000 }}
          gl={{ antialias: true, preserveDrawingBuffer: true }}
          frameloop="always"
        >
          <color attach="background" args={['#0b0f1a']} />
          <ambientLight intensity={0.5} color="#ffd6a8" />
          <directionalLight position={[50, 100, 40]} intensity={1.4} color="#fff1db" />
          <Track />
        </Canvas>
      </div>
    </WorldProvider>
  );
}
