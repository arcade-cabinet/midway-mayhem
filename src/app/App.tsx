/**
 * Root component. Pure composition — no logic here. All state lives in
 * the koota world (src/ecs/), all rendering in src/render/.
 */
import { WorldProvider } from 'koota/react';
import { world } from '@/ecs/world';

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
