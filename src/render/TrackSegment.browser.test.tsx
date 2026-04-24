/**
 * Component visual gate for a SINGLE track archetype.
 *
 * Each archetype (straight, slight-left, hard-right, dip, climb, plunge)
 * gets its own isolated render. We spawn ONE TrackSegment entity with
 * that archetype, extract the WebGL canvas.toDataURL() directly (which
 * gives us the true backing-buffer resolution rather than the iframe's
 * CSS-scaled display size), and write the PNG to
 * .test-screenshots/archetypes/ via our writePngFromDataUrl server command.
 *
 * This is the lowest level visual gate: if a single archetype doesn't
 * look right, nothing composed from them will either. Integration tests
 * that render full tracks come LATER.
 */
import { render, waitFor } from '@testing-library/react';
import { commands } from 'vitest/browser';
import { createWorld } from 'koota';
import { WorldProvider } from 'koota/react';
import { describe, expect, it } from 'vitest';
import { trackArchetypes } from '@/config';
import { LaneCount, TrackSegment } from '@/ecs/traits';
import { Track } from '@/render/Track';
import { renderAndCapture, Scene, waitFrames } from '@/test/scene';

function spawnSingle(world: ReturnType<typeof createWorld>, archetypeId: string) {
  const arch = trackArchetypes.archetypes.find(
    (a: (typeof trackArchetypes.archetypes)[number]) => a.id === archetypeId,
  );
  if (!arch) throw new Error(`unknown archetype: ${archetypeId}`);
  world.spawn(
    TrackSegment({
      index: 0,
      archetype: arch.id,
      distanceStart: 0,
      length: arch.length,
      deltaYaw: arch.deltaYaw,
      deltaPitch: arch.deltaPitch,
      bank: arch.bank,
    }),
    LaneCount({ value: trackArchetypes.lanes }),
  );
}

// Camera: elevated 3/4 view that makes curves + pitches obvious.
const CAM_POS: [number, number, number] = [0, 8, 10];
const CAM_LOOK: [number, number, number] = [0, 0, -10];

describe('Track archetype — single piece visual', () => {
  for (const archetype of trackArchetypes.archetypes) {
    it(`renders a "${archetype.id}" segment`, async () => {
      const world = createWorld();
      spawnSingle(world, archetype.id);

      render(
        <WorldProvider world={world}>
          <Scene size={{ width: 1280, height: 720 }} cameraPosition={CAM_POS} lookAt={CAM_LOOK}>
            <Track />
          </Scene>
        </WorldProvider>,
      );

      await waitFor(() => expect(window.__mmTest).toBeTruthy());
      await waitFrames(4);

      const canvas = window.__mmTest!.gl.domElement;
      expect(canvas.width).toBeGreaterThanOrEqual(1280);
      expect(canvas.height).toBeGreaterThanOrEqual(720);

      const dataUrl = renderAndCapture();
      expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);

      const result = await commands.writePngFromDataUrl(
        dataUrl,
        `.test-screenshots/archetypes/${archetype.id}.png`,
      );
      // Solid track geometry + colored materials → PNG should be well over 5KB.
      expect(result.bytes).toBeGreaterThan(5_000);
    });
  }
});
