/**
 * A-DESC-5 browser visual gate — Audience (crowd silhouettes).
 *
 * Mounts the Audience component alone under an orthographic-like top-down
 * perspective camera so all 2000 capsule silhouettes project into the
 * frame. We assert:
 *   - The canvas actually drew something (triangle count > 0).
 *   - The PNG written to disk exceeds a size threshold (crowd visible).
 *
 * Screenshot is captured to .test-screenshots/audience/plan.png for
 * human review and future baseline pinning.
 */
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { renderAndCapture, Scene, waitFrames } from '@/test/scene';
import { Audience } from './Audience';

// Top-down camera far enough out to frame the full r=120m ring.
const CAM_POS: [number, number, number] = [0, 200, 0.1]; // slight Z so lookAt doesn't collapse
const CAM_LOOK: [number, number, number] = [0, 0, 0];

describe('Audience — crowd silhouettes (A-DESC-5)', () => {
  it('renders 2000 capsule instances visible from above', async () => {
    render(
      <Scene size={{ width: 1280, height: 720 }} cameraPosition={CAM_POS} lookAt={CAM_LOOK}>
        <Audience />
      </Scene>,
    );

    // Wait for SceneCapture to mount.
    await waitFor(() => expect(window.__mmTest).toBeTruthy());
    // Let useFrame run several ticks so matrices + colors are written.
    await waitFrames(8);

    const gl = window.__mmTest!.gl;
    // InstancedMesh of 2000 capsules → many triangles.
    expect(gl.info.render.triangles, 'expected crowd geometry to draw triangles').toBeGreaterThan(
      1000,
    );

    const dataUrl = renderAndCapture();
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);

    const result = await commands.writePngFromDataUrl(
      dataUrl,
      '.test-screenshots/audience/plan.png',
    );
    // 2000 colored capsules on a dark background → should be well over 20 KB.
    expect(result.bytes, 'audience PNG too small — crowd may not be visible').toBeGreaterThan(
      20_000,
    );
  });
});
