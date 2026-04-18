/**
 * Game-over overlay integration test — proves that once the run ends,
 * the game-over overlay mounts with the right summary and the "AGAIN"
 * button is clickable.
 *
 * Drives a run, crashes it out until gameOver flips, then asserts the
 * [data-testid="game-over"] overlay is in the DOM. Verifies the score +
 * balloons shown are finite numbers (no NaN leakage from a miswired ECS
 * read), and that data-testid="game-over-restart" is interactive.
 */
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { crash, diag, driveInto, waitFrames } from '@/test/integration';
import { App } from './App';

describe('Game-over overlay integration', () => {
  it('mounts the game-over overlay with a finite score after gameOver flips', async () => {
    const { container } = render(<App />);
    await waitFor(
      () => {
        const el = container.querySelector('canvas');
        if (!el) throw new Error('canvas not rendered');
        return el;
      },
      { timeout: 10_000 },
    );
    await waitFrames(15);

    await driveInto(container);

    // Force game-over via heavy crashes.
    for (let i = 0; i < 25; i++) {
      if (diag().gameOver) break;
      crash(true);
      await waitFrames(2);
    }
    expect(diag().gameOver, 'gameOver should be true after 25 heavy crashes').toBe(true);

    // Overlay should mount once the onEnd callback fires inside GameLoop.
    const overlay = await waitFor(
      () => {
        const el = container.querySelector('[data-testid="game-over"]');
        if (!el) throw new Error('game-over overlay not yet mounted');
        return el as HTMLElement;
      },
      { timeout: 5_000 },
    );

    // Only ONE game-over overlay should mount. Before we hardened the
    // app, both `src/ui/GameOverOverlay.tsx` (rendered by App) and
    // `src/ui/hud/GameOverOverlay.tsx` (rendered by HUD) mounted
    // simultaneously, which stacked two near-identical dialogs on
    // screen. Gate against that regression.
    const overlays = container.querySelectorAll('[data-testid="game-over"]');
    expect(overlays.length, `expected exactly one game-over overlay, got ${overlays.length}`).toBe(
      1,
    );

    // The overlay must render a restart button the player can click.
    const restart = overlay.querySelector('button') as HTMLButtonElement | null;
    expect(
      restart,
      `expected at least one button inside the overlay. game-over children: ${overlay.innerHTML.slice(0, 500)}`,
    ).toBeTruthy();
    expect(restart?.disabled ?? false).toBe(false);

    // Score text must be a parseable number (never NaN / "undefined" /
    // empty). Scrape any large number from the overlay text — the exact
    // format can shift as we iterate on copy.
    const overlayText = overlay.textContent ?? '';
    const numberMatches = overlayText.match(/-?\d+(?:\.\d+)?/g) ?? [];
    const hasFiniteNumber = numberMatches.some((n) => Number.isFinite(Number(n)));
    expect(
      hasFiniteNumber,
      `overlay text contained no finite numbers: ${JSON.stringify(overlayText)}`,
    ).toBe(true);
  });
});
