/**
 * Integration visual gate: composed track (all 80 pieces) from known seeds.
 *
 * This is strictly downstream of the single-archetype tests — if any
 * archetype doesn't render right in isolation, this will lie about the
 * whole track looking OK. We render the full composed track from multiple
 * seeds so "it only works on 42" regressions get caught.
 *
 * Screenshots dump via `writePngFromDataUrl` command at real canvas
 * backing-buffer resolution (1280×720) for human review. Also asserts that
 * the canvas actually drew something (non-trivial triangle count + non-zero
 * PNG size) as a cheap oracle that composition didn't blow up.
 */
import { render, waitFor } from '@testing-library/react';
import { commands } from 'vitest/browser';
import { createWorld } from 'koota';
import { WorldProvider } from 'koota/react';
import { describe, expect, it } from 'vitest';
import { seedTrack } from '@/ecs/systems/track';
import { BigTopEnvironment } from '@/render/Environment';
import { Track } from '@/render/Track';
import { renderAndCapture, renderAndCountTriangles, Scene } from '@/test/scene';

interface View {
  name: string;
  cam: [number, number, number];
  look: [number, number, number];
  /** Wrap scene contents in <BigTopEnvironment> so the test matches the
   *  look of the actual game. Skipped on the overhead camera because the
   *  HDRI dominates an overhead framing and obscures the geometry we want
   *  to judge. */
  withEnv: boolean;
}

const VIEWS: View[] = [
  // Track plunges heavily (pitch up to ±0.8 rad) over 80 pieces, so we need
  // a very wide orbital that looks at the track body's midpoint in Y (~−300m)
  // not at the starting origin (y=0). Otherwise most of the track is below
  // the camera's frustum. Also pulled out on X/Z to frame 1000m+ of track.
  { name: 'overhead', cam: [400, 400, 400], look: [-100, -300, -600], withEnv: false },
  // Player POV: eye at y=1.8 (seated), just above track surface (y=0.5), looking
  // 30m down the track so the first few pieces dominate the frame.
  { name: 'pov', cam: [0, 2.3, 5], look: [0, 1.8, -30], withEnv: true },
  { name: 'descent', cam: [0, 80, 60], look: [0, -30, -200], withEnv: true },
];

const SEEDS = [42, 7];

describe('Track (composed, full 80 pieces)', () => {
  for (const seed of SEEDS) {
    for (const view of VIEWS) {
      it(`seed ${seed} — ${view.name}`, async () => {
        const world = createWorld();
        seedTrack(world, seed);

        render(
          <WorldProvider world={world}>
            <Scene size={{ width: 1280, height: 720 }} cameraPosition={view.cam} lookAt={view.look}>
              {view.withEnv ? <BigTopEnvironment skipHdri /> : null}
              <Track />
            </Scene>
          </WorldProvider>,
        );

        await waitFor(() => expect(window.__mmTest).toBeTruthy());
        // Track is wrapped in <Suspense>; PBR textures take a variable number
        // of frames to resolve. Poll until the geometry is actually submitted.
        await waitFor(
          () => {
            const tris = renderAndCountTriangles();
            if (tris < 500) throw new Error(`track not yet rendered (${tris} tris)`);
          },
          { timeout: 10_000, interval: 50 },
        );
        expect(renderAndCountTriangles()).toBeGreaterThan(500);

        const dataUrl = renderAndCapture();
        const result = await commands.writePngFromDataUrl(
          dataUrl,
          `.test-screenshots/track/seed-${seed}-${view.name}.png`,
        );
        expect(result.bytes).toBeGreaterThan(10_000);
      });
    }
  }
});
