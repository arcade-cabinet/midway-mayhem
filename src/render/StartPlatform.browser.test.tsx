/**
 * StartPlatform visual baseline — confirms the platform renders high inside
 * the dome with visible wire struts extending upward out of frame.
 *
 * Camera framing: positioned below and in front of the platform so the
 * wire struts read as going UP into the rafters. The player is supposed to
 * feel the HEIGHT here — looking DOWN at the coil far below.
 *
 * What to check in the PNG:
 *   - Platform deck visible in mid-frame with polka-dot trim rails
 *   - Steel-chrome wire struts extending upward toward the top edge
 *   - Dark big-top interior behind the platform (no ground visible)
 *   - START sign legible at the back of the platform
 *
 * Screenshot path: .test-screenshots/start-platform/elevated.png
 */
import { render, waitFor } from '@testing-library/react';
import { createWorld } from 'koota';
import { WorldProvider } from 'koota/react';
import { describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { spawnPlayer } from '@/ecs/systems/playerMotion';
import { seedTrack } from '@/ecs/systems/track';
import { buildRunPlan } from '@/game/runPlan';
import { setPlan } from '@/game/runPlanRefs';
import { initRunRng, trackRng } from '@/game/runRngBus';
import { PLATFORM_Y, StartPlatform } from '@/render/track/StartPlatform';
import { renderAndCapture, renderAndCountTriangles, Scene } from '@/test/scene';

const SEED = 42;

describe('StartPlatform — visual elevation baseline', () => {
  it('renders platform hung high with wire struts going up out of frame', async () => {
    const world = createWorld();
    spawnPlayer(world);
    seedTrack(world, SEED);
    initRunRng(SEED);
    const plan = buildRunPlan({ seed: SEED, trackRng: trackRng() });
    setPlan(plan);

    // Camera sits ~18m below the platform, angled upward toward the deck so
    // wire struts read as going UP into rafters above the frame edge.
    const camY = PLATFORM_Y - 18; // ≈ +12m world-space
    const lookY = PLATFORM_Y - 2; // aim near the deck bottom

    render(
      <WorldProvider world={world}>
        <Scene
          size={{ width: 1280, height: 720 }}
          cameraPosition={[0, camY, 30]}
          lookAt={[0, lookY, 0]}
        >
          <StartPlatform />
        </Scene>
      </WorldProvider>,
    );

    await waitFor(() => expect(window.__mmTest).toBeTruthy(), { timeout: 10_000 });
    // Poll for real geometry — useSampledTrack() is async on the ECS query,
    // so the platform is empty for the first few frames after mount.
    await waitFor(
      () => {
        const tris = renderAndCountTriangles();
        if (tris < 50) throw new Error(`platform not yet rendered (${tris} tris)`);
      },
      { timeout: 10_000, interval: 50 },
    );

    // Wire struts + deck + trim blocks + sign should produce a meaningful
    // triangle count. The deck alone is 12 tris, each strut ~16, trim ~many.
    expect(
      renderAndCountTriangles(),
      'expected platform geometry to produce non-trivial triangle count',
    ).toBeGreaterThan(50);

    const dataUrl = renderAndCapture();
    const result = await commands.writePngFromDataUrl(
      dataUrl,
      '.test-screenshots/start-platform/elevated.png',
    );
    expect(result.bytes, 'screenshot must contain real pixel data').toBeGreaterThan(5_000);
  });
});
