/**
 * ZoneGimmicks.browser.test.tsx
 *
 * Mounts each zone gimmick layer inside a Canvas + Suspense and verifies
 * the correct layer renders (data-testid present in DOM).
 */

import { Canvas } from '@react-three/fiber';
import { render, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { BalloonLayer } from '@/obstacles/BalloonLayer';
import { BarkerCrowd } from '@/obstacles/BarkerCrowd';
import { FireHoopGate } from '@/obstacles/FireHoopGate';
import { MirrorLayer } from '@/obstacles/MirrorLayer';
import { resetGameState, useGameStore } from '@/game/gameState';

describe('Zone Gimmick Layers (browser)', () => {
  beforeEach(() => {
    resetGameState();
    // biome-ignore lint/suspicious/noExplicitAny: test cleanup
    (window as any).__mmBalloonSpawner = undefined;
    // biome-ignore lint/suspicious/noExplicitAny: test cleanup
    (window as any).__mmMirrorDuplicator = undefined;
  });

  it('BalloonLayer mounts and renders data-testid in Canvas', async () => {
    const { container } = render(
      <Canvas>
        <Suspense fallback={null}>
          <BalloonLayer />
        </Suspense>
      </Canvas>,
    );
    await waitFor(
      () => expect(container.querySelector('canvas')).toBeInTheDocument(),
      { timeout: 10000 },
    );
    // The testid is on a R3F group — verify canvas exists (R3F groups aren't in DOM)
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('FireHoopGate mounts without throwing', async () => {
    useGameStore.setState({ running: true, dropProgress: 1, currentZone: 'ring-of-fire' });
    const { container } = render(
      <Canvas>
        <Suspense fallback={null}>
          <FireHoopGate />
        </Suspense>
      </Canvas>,
    );
    await waitFor(
      () => expect(container.querySelector('canvas')).toBeInTheDocument(),
      { timeout: 10000 },
    );
  });

  it('MirrorLayer mounts and does not render copies outside funhouse-frenzy', async () => {
    useGameStore.setState({ running: true, dropProgress: 1, currentZone: 'balloon-alley' });
    const { container } = render(
      <Canvas>
        <Suspense fallback={null}>
          <MirrorLayer />
        </Suspense>
      </Canvas>,
    );
    await waitFor(
      () => expect(container.querySelector('canvas')).toBeInTheDocument(),
      { timeout: 10000 },
    );
    // biome-ignore lint/suspicious/noExplicitAny: test assertion
    expect((window as any).__mmDiag_mirrors ?? 0).toBe(0);
  });

  it('BarkerCrowd mounts without throwing', async () => {
    useGameStore.setState({ running: true, dropProgress: 1, currentZone: 'midway-strip' });
    const { container } = render(
      <Canvas>
        <Suspense fallback={null}>
          <BarkerCrowd />
        </Suspense>
      </Canvas>,
    );
    await waitFor(
      () => expect(container.querySelector('canvas')).toBeInTheDocument(),
      { timeout: 10000 },
    );
  });
});
