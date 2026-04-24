/**
 * @module render/obstacles/ThemedObstacle.browser.test
 *
 * Browser (real-GPU) visual regression test for themed obstacle GLBs.
 *
 * For each ObstacleKind:
 *   1. Mount the appropriate ThemedObstacle component in an isolated Scene.
 *   2. Wait for the GLB to load (no blank frames).
 *   3. Capture a screenshot to .test-screenshots/obstacles/<kind>.png.
 *   4. Assert non-trivial triangle count (the GLB actually rendered).
 *   5. Assert PNG size > 5 KB (non-blank canvas).
 *
 * Baselines are pinned under src/render/obstacles/__baselines__/.
 * The pixel-diff gate is in a separate node test (obstacleBaselines.test.ts)
 * following the cockpit pattern.
 *
 * The hammer and critter kinds use their animated wrappers (ThemedHammer,
 * ThemedCritter) with static inputs so screenshots are deterministic.
 */
import { render, waitFor } from '@testing-library/react';
import { commands } from 'vitest/browser';
import { Suspense } from 'react';
import { describe, expect, it } from 'vitest';
import { renderAndCapture, Scene, waitFrames } from '@/test/scene';
import { StaticObstacle, ThemedCritter, ThemedHammer } from './ThemedObstacle';

const CENTER: [number, number, number] = [0, 0, 0];
const CAM: [number, number, number] = [3, 3, 5];
const LOOK: [number, number, number] = [0, 1, 0];

describe('ThemedObstacle — per-kind GLB render', () => {
  it('cone renders without blank frame', async () => {
    render(
      <Scene size={{ width: 800, height: 600 }} cameraPosition={CAM} lookAt={LOOK}>
        <Suspense fallback={null}>
          <StaticObstacle kind="cone" position={CENTER} yaw={0} />
        </Suspense>
      </Scene>,
    );

    await waitFor(() => expect(window.__mmTest).toBeTruthy());
    await waitFrames(12);

    const gl = window.__mmTest!.gl;
    expect(gl.info.render.triangles).toBeGreaterThan(10);

    const dataUrl = renderAndCapture();
    const result = await commands.writePngFromDataUrl(
      dataUrl,
      '.test-screenshots/obstacles/cone.png',
    );
    expect(result.bytes).toBeGreaterThan(5_000);
  });

  it('barrier renders without blank frame', async () => {
    render(
      <Scene size={{ width: 800, height: 600 }} cameraPosition={CAM} lookAt={LOOK}>
        <Suspense fallback={null}>
          <StaticObstacle kind="barrier" position={CENTER} yaw={0} />
        </Suspense>
      </Scene>,
    );

    await waitFor(() => expect(window.__mmTest).toBeTruthy());
    await waitFrames(12);

    expect(window.__mmTest!.gl.info.render.triangles).toBeGreaterThan(10);
    const dataUrl = renderAndCapture();
    const result = await commands.writePngFromDataUrl(
      dataUrl,
      '.test-screenshots/obstacles/barrier.png',
    );
    expect(result.bytes).toBeGreaterThan(5_000);
  });

  it('gate renders without blank frame', async () => {
    render(
      <Scene size={{ width: 800, height: 600 }} cameraPosition={CAM} lookAt={LOOK}>
        <Suspense fallback={null}>
          <StaticObstacle kind="gate" position={CENTER} yaw={0} />
        </Suspense>
      </Scene>,
    );

    await waitFor(() => expect(window.__mmTest).toBeTruthy());
    await waitFrames(12);

    expect(window.__mmTest!.gl.info.render.triangles).toBeGreaterThan(10);
    const dataUrl = renderAndCapture();
    const result = await commands.writePngFromDataUrl(
      dataUrl,
      '.test-screenshots/obstacles/gate.png',
    );
    expect(result.bytes).toBeGreaterThan(5_000);
  });

  it('oil renders without blank frame', async () => {
    render(
      <Scene size={{ width: 800, height: 600 }} cameraPosition={CAM} lookAt={LOOK}>
        <Suspense fallback={null}>
          <StaticObstacle kind="oil" position={CENTER} yaw={0} />
        </Suspense>
      </Scene>,
    );

    await waitFor(() => expect(window.__mmTest).toBeTruthy());
    await waitFrames(12);

    expect(window.__mmTest!.gl.info.render.triangles).toBeGreaterThan(10);
    const dataUrl = renderAndCapture();
    const result = await commands.writePngFromDataUrl(
      dataUrl,
      '.test-screenshots/obstacles/oil.png',
    );
    expect(result.bytes).toBeGreaterThan(5_000);
  });

  it('hammer renders without blank frame', async () => {
    render(
      <Scene size={{ width: 800, height: 600 }} cameraPosition={CAM} lookAt={[0, -1, 0]}>
        <Suspense fallback={null}>
          <ThemedHammer position={[0, 0, 0]} yaw={0} swingPhase={0} />
        </Suspense>
      </Scene>,
    );

    await waitFor(() => expect(window.__mmTest).toBeTruthy());
    await waitFrames(12);

    expect(window.__mmTest!.gl.info.render.triangles).toBeGreaterThan(10);
    const dataUrl = renderAndCapture();
    const result = await commands.writePngFromDataUrl(
      dataUrl,
      '.test-screenshots/obstacles/hammer.png',
    );
    expect(result.bytes).toBeGreaterThan(5_000);
  });

  it('critter renders without blank frame', async () => {
    render(
      <Scene size={{ width: 800, height: 600 }} cameraPosition={CAM} lookAt={LOOK}>
        <Suspense fallback={null}>
          <ThemedCritter
            baseX={0}
            baseY={0}
            baseZ={0}
            yaw={0}
            critterKind="horse"
            fleeStartedAt={0}
            fleeDir={0}
          />
        </Suspense>
      </Scene>,
    );

    await waitFor(() => expect(window.__mmTest).toBeTruthy());
    await waitFrames(12);

    expect(window.__mmTest!.gl.info.render.triangles).toBeGreaterThan(10);
    const dataUrl = renderAndCapture();
    const result = await commands.writePngFromDataUrl(
      dataUrl,
      '.test-screenshots/obstacles/critter.png',
    );
    expect(result.bytes).toBeGreaterThan(5_000);
  });
});
