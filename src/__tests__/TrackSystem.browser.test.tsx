import { Canvas } from '@react-three/fiber';
import { render, waitFor } from '@testing-library/react';
import { Suspense } from 'react';
import { describe, expect, it } from 'vitest';
import { TrackSystem } from '../components/TrackSystem';
import { composeTrack, DEFAULT_TRACK } from '../game/trackComposer';

describe('<TrackSystem /> browser', () => {
  it('produces a sane composition for DEFAULT_TRACK', () => {
    const r = composeTrack(DEFAULT_TRACK, 10);
    expect(r.placements.length).toBe(DEFAULT_TRACK.length);
    expect(r.totalLength).toBeGreaterThan(100);
  });

  it('mounts TrackSystem inside a Canvas + Suspense without throwing', async () => {
    const { container } = render(
      <Canvas>
        <Suspense fallback={null}>
          <TrackSystem />
        </Suspense>
      </Canvas>,
    );
    await waitFor(
      () => expect(container.querySelector('canvas')).toBeInTheDocument(),
      { timeout: 10000 },
    );
  });
});
