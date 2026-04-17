import { expect, test } from '@playwright/test';
import { expectNoErrorModal, waitForHudReady } from './helpers';

/**
 * Visual regression baselines per form factor.
 *
 * We intentionally avoid snapshotting the WebGL canvas — HDRI + procedural
 * music + seeded run state produce frame-level nondeterminism that isn't a
 * bug. Instead we snapshot the DOM overlays (title screen + HUD frame +
 * HONK button) which ARE deterministic and are exactly what the responsive
 * system is supposed to pin down per tier.
 *
 * Each project (visual-desktop, visual-tablet, visual-phone-portrait,
 * visual-phone-landscape) runs the same specs and writes baselines to
 * __screenshots__/visual.spec.ts/<name>-<project>.png.
 *
 * Regenerate baselines with: pnpm test:e2e --update-snapshots --project visual-*
 */

test.describe('Visual regression — responsive', () => {
  test('title screen renders deterministically', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="title-screen"]', { state: 'visible' });
    // Let confetti background paint
    await page.waitForTimeout(300);
    await expect(page.getByTestId('title-screen')).toHaveScreenshot('title.png');
    await expectNoErrorModal(page);
  });

  test('HUD layout at current viewport', async ({ page }) => {
    await page.goto('/?skip=1');
    await waitForHudReady(page);
    // Let drop-in settle + HUD stabilize; blank dynamic numerics AND hide the
    // webgl canvas so the baseline is a pure DOM layout comparison.
    await page.waitForTimeout(2200);
    await page.addStyleTag({
      content: `
        *, *::before, *::after { animation: none !important; transition: none !important; }
        canvas { visibility: hidden !important; }
        .mm-stat-value { color: transparent !important; }
        [data-testid="zone-banner"] { opacity: 0 !important; }
      `,
    });
    await expect(page).toHaveScreenshot('hud.png', { fullPage: false });
    await expectNoErrorModal(page);
  });
});
