import { Canvas } from '@react-three/fiber';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Cockpit } from '../components/Cockpit';

describe('<Cockpit /> browser', () => {
  it('mounts inside a Canvas without throwing', async () => {
    const { container } = render(
      <Canvas>
        <Cockpit />
      </Canvas>,
    );
    // Wait briefly for Canvas to establish GL context
    await new Promise((r) => setTimeout(r, 200));
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas?.getContext('webgl2') || canvas?.getContext('webgl')).toBeTruthy();
  });
});
