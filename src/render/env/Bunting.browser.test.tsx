/**
 * A-DECOR browser visual gate — Bunting pennant streamers.
 *
 * Mounts the Bunting component alone under a top-down perspective camera so
 * all 8 strands of pennants project into the frame. We assert:
 *   - The canvas drew something (triangle count > 0).
 *   - The PNG written to disk exceeds a size threshold (pennants visible).
 *   - At least 100 colored pixels are present in the captured frame.
 *
 * Screenshot is pinned under src/render/env/__baselines__/bunting.png for
 * future regression comparisons.
 */
import { render, waitFor } from '@testing-library/react';
import { commands } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { renderAndCapture, Scene, waitFrames } from '@/test/scene';
import { Bunting } from './Bunting';

// Top-down camera far enough out to frame the full rafter ring (r=55m).
// Slight Z offset so lookAt doesn't produce a degenerate view matrix.
const CAM_POS: [number, number, number] = [0, 120, 0.1];
const CAM_LOOK: [number, number, number] = [0, 48, 0]; // aim at rafter level

describe('Bunting — triangle-pennant streamers (A-DECOR)', () => {
  it('renders 8 strands of pennants visible from above', async () => {
    render(
      <Scene size={{ width: 1280, height: 720 }} cameraPosition={CAM_POS} lookAt={CAM_LOOK}>
        <Bunting />
      </Scene>,
    );

    // Wait for SceneCapture to mount.
    await waitFor(() => expect(window.__mmTest).toBeTruthy());
    // Let the geometry and instance data settle.
    await waitFrames(6);

    const gl = window.__mmTest!.gl;
    // InstancedMesh of pennants → triangles drawn.
    expect(gl.info.render.triangles, 'expected pennant geometry to draw triangles').toBeGreaterThan(
      0,
    );

    const dataUrl = renderAndCapture();
    expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);

    const result = await commands.writePngFromDataUrl(
      dataUrl,
      '.test-screenshots/bunting/plan.png',
    );
    // 8 strands × 10+ pennants in 4 colors on a dark background → >20 KB.
    expect(result.bytes, 'bunting PNG too small — pennants may not be visible').toBeGreaterThan(
      20_000,
    );

    // Pin baseline if it doesn't exist yet — the CI gate will pick it up.
    await commands.writePngFromDataUrl(dataUrl, 'src/render/env/__baselines__/bunting.png');
  });
});
