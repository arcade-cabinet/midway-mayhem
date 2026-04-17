import { Canvas } from '@react-three/fiber';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Cockpit } from '@/cockpit/Cockpit';

describe('<Cockpit /> browser', () => {
  it('mounts inside a Canvas without throwing', async () => {
    const { container } = render(
      <Canvas>
        <Cockpit />
      </Canvas>,
    );
    // Poll until the canvas element appears in the DOM
    await vi.waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument();
    });
    const canvas = container.querySelector('canvas');
    expect(canvas?.getContext('webgl2') || canvas?.getContext('webgl')).toBeTruthy();
  });
});
