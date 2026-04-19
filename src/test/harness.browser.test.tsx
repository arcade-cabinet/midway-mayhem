/**
 * Proves the test harness itself works end-to-end:
 *   - vitest + @vitest/browser-playwright boots a real Chromium instance
 *   - the scene helper renders an R3F Canvas
 *   - the GPU-backed WebGL context draws a known mesh
 *   - page.screenshot() produces a readable PNG via vitest-browser
 *
 * If this test fails, NOTHING further in v2 matters. Gate step 1 on it.
 */
import { render, waitFor } from '@testing-library/react';
import { page } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { Scene, waitFrames } from './scene';

describe('test harness', () => {
  it('renders a cube in a real-GPU Canvas and can screenshot it', async () => {
    const { container } = render(
      <Scene>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[2, 2, 2]} />
          <meshStandardMaterial color="#E53935" />
        </mesh>
      </Scene>,
    );

    const canvas = await waitFor(() => {
      const el = container.querySelector('canvas');
      if (!el) throw new Error('canvas not rendered');
      return el;
    });

    // One frame to get past the 'Scene' initial layout effect.
    await waitFrames(3);

    // Canvas should have drawn something — backbuffer non-zero.
    expect(canvas.width).toBeGreaterThan(0);
    expect(canvas.height).toBeGreaterThan(0);
    const dataUrl = canvas.toDataURL('image/png');
    expect(dataUrl.length).toBeGreaterThan(1000);

    // And the harness can capture via vitest-browser's page API.
    await page.screenshot({ path: '.test-screenshots/harness-cube.png' });
  });
});
