/**
 * @module e2e/loadout
 *
 * Cockpit customisation smoke tests.
 *
 * Relies on the ?diag=1 hook which exposes window.__mm.equip() and
 * window.__mm.getLoadout() — thin wrappers around useLoadoutStore.
 *
 * We deliberately avoid snapshotting the WebGL canvas for palette colour
 * because the HDRI + Tone.js jitter make pixel-exact comparisons brittle.
 * Instead we verify that:
 *   1. equip() persists the new slug into the loadout store.
 *   2. The cockpit stays alive after the equip (no crash modal fires).
 *   3. Screenshots of the HUD overlay (DOM, not WebGL) are stable — captured
 *      for reference / manual inspection without a strict diff assertion.
 */

import { expect, test } from '@playwright/test';
import { expectNoErrorModal, waitForHudReady } from './helpers';

// ── helpers ──────────────────────────────────────────────────────────────────

interface LoadoutSnapshot {
  palette: string;
  ornament: string;
  horn: string;
  hornShape: string;
  rim: string;
  dice: string;
}

async function getLoadout(page: Parameters<typeof waitForHudReady>[0]): Promise<LoadoutSnapshot> {
  return await page.evaluate(() => {
    // biome-ignore lint/suspicious/noExplicitAny: diag bridge
    const mm = (window as any).__mm;
    if (!mm?.getLoadout) throw new Error('window.__mm.getLoadout unavailable');
    const row = mm.getLoadout();
    if (!row) throw new Error('loadout row is null');
    return {
      palette: row.palette,
      ornament: row.ornament,
      horn: row.horn,
      hornShape: row.hornShape,
      rim: row.rim,
      dice: row.dice,
    };
  });
}

async function equipItem(
  page: Parameters<typeof waitForHudReady>[0],
  kind: string,
  slug: string,
): Promise<void> {
  await page.evaluate(
    async ({ kind, slug }) => {
      // biome-ignore lint/suspicious/noExplicitAny: diag bridge
      const mm = (window as any).__mm;
      if (!mm?.equip) throw new Error('window.__mm.equip unavailable');
      await mm.equip(kind, slug);
    },
    { kind, slug },
  );
}

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe('Cockpit loadout — equip via diag hook', () => {
  test('loadout is initialised with starter palette (classic)', async ({ page }) => {
    await page.goto('/?skip=1&diag=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page);

    const loadout = await getLoadout(page);
    expect(loadout.palette).toBe('classic');
    await expectNoErrorModal(page);
  });

  test('equip neon-circus palette — store reflects new slug', async ({ page }) => {
    await page.goto('/?skip=1&diag=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page);

    await equipItem(page, 'palette', 'neon-circus');

    const loadout = await getLoadout(page);
    expect(loadout.palette).toBe('neon-circus');
    await expectNoErrorModal(page);
  });

  test('equip air-horn — store reflects new horn slug', async ({ page }) => {
    await page.goto('/?skip=1&diag=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page);

    await equipItem(page, 'horn', 'air-horn');

    const loadout = await getLoadout(page);
    expect(loadout.horn).toBe('air-horn');
    await expectNoErrorModal(page);
  });

  test('equip gold rim — store reflects new rim slug', async ({ page }) => {
    await page.goto('/?skip=1&diag=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page);

    await equipItem(page, 'rim', 'gold');

    const loadout = await getLoadout(page);
    expect(loadout.rim).toBe('gold');
    await expectNoErrorModal(page);
  });

  test('equip palette then screenshot cockpit HUD overlay', async ({ page }) => {
    await page.goto('/?skip=1&diag=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page);

    // Equip a visually distinct palette
    await equipItem(page, 'palette', 'neon-circus');
    // Allow one React render cycle + useFrame to propagate the material update
    await page.waitForTimeout(200);
    await expectNoErrorModal(page);

    // Capture HUD overlay (DOM layer — deterministic for visual reference)
    await page.addStyleTag({
      content: `
        *, *::before, *::after { animation: none !important; transition: none !important; }
        canvas { visibility: hidden !important; }
        .mm-stat-value { color: transparent !important; }
        [data-testid="zone-banner"] { opacity: 0 !important; }
      `,
    });
    await expect(page).toHaveScreenshot('loadout-neon-circus-hud.png', { fullPage: false });
  });

  test('multiple equips in sequence — store stays consistent', async ({ page }) => {
    await page.goto('/?skip=1&diag=1');
    await waitForHudReady(page);
    await expectNoErrorModal(page);

    await equipItem(page, 'palette', 'pastel-dream');
    await equipItem(page, 'rim', 'purple-candy');
    await equipItem(page, 'dice', 'gold-black');

    const loadout = await getLoadout(page);
    expect(loadout.palette).toBe('pastel-dream');
    expect(loadout.rim).toBe('purple-candy');
    expect(loadout.dice).toBe('gold-black');
    await expectNoErrorModal(page);
  });
});
