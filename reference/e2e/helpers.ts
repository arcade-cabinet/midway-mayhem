import { expect, type Page } from '@playwright/test';

/** Assert the global ErrorModal has not fired. */
export async function expectNoErrorModal(page: Page): Promise<void> {
  await expect(page.getByTestId('error-modal')).toHaveCount(0);
}

/** Wait until the HUD has rendered and reports live state. */
export async function waitForHudReady(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="hud"]', {
    state: 'visible',
    timeout: 30_000,
  });
  await expect(page.getByTestId('hud-hype')).toBeVisible();
}

/** Read the live diagnostics dump (requires ?diag=1 or dev mode). */
export async function readDiag(page: Page): Promise<{
  distance: number;
  speedMps: number;
  hype: number;
  sanity: number;
  fps: number;
  crashes: number;
  crowdReaction: number;
  gameOver: boolean;
  running: boolean;
  currentZone: string;
  obstacleCount: number;
  pickupCount: number;
  steer: number;
  lateral: number;
}> {
  return await page.evaluate(() => {
    // biome-ignore lint/suspicious/noExplicitAny: diag
    const mm = (window as any).__mm;
    if (!mm?.diag) throw new Error('window.__mm.diag is unavailable');
    return mm.diag();
  });
}

/** Simulate pointer steering via real events on the canvas. */
export async function steerByMouse(page: Page, normX: number): Promise<void> {
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('Canvas bounding box unavailable');
  const targetX = box.x + box.width * (0.5 + normX * 0.5);
  const targetY = box.y + box.height / 2;
  await page.mouse.move(targetX, targetY);
}
