/**
 * Root component. Pure composition — all state lives in the koota world
 * (src/ecs/), all rendering in src/render/.
 *
 * Note (2026-04-17): the Track is proven working via vitest-browser tests
 * that hit a real GPU in installed Chrome. Wiring the live Canvas into
 * the dev-server App shell is a separate unresolved issue — R3F's render
 * loop never kicks in on the dev page despite passing in tests. Will fix
 * next pass. For now the root shows a bootstrapping indicator so the
 * page renders SOMETHING while the v2 scaffolding settles.
 */
import { WorldProvider } from 'koota/react';
import { world } from '@/ecs/world';
import { seedTrack } from '@/ecs/systems/track';

// Seed the track on module load so when the dev-server Canvas is wired up,
// the entities are already there.
seedTrack(world, 42);

export function App() {
  return (
    <WorldProvider world={world}>
      <div
        data-testid="mm-app"
        style={{
          position: 'absolute',
          inset: 0,
          background: '#0b0f1a',
          color: '#FFD600',
          fontFamily: 'system-ui, sans-serif',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <p>v2 bootstrapping — Midway Mayhem</p>
      </div>
    </WorldProvider>
  );
}
