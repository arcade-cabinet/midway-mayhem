/**
 * Deterministic seed test factory + interval diagnostics dump.
 *
 * A playthrough is defined by:
 *   - seed / phrase (→ identical track + content + event schedule every run)
 *   - difficulty
 *   - viewport (form-factor tier)
 *   - intervalMs (how often to sample) and maxFrames (cap)
 *
 * At each interval we:
 *   - call window.__mm.diag() → JSON snapshot (distance, speed, zone, etc)
 *   - take a PNG screenshot
 *   - persist both to test-results/<spec>/<project>/<testId>/<seed>/frame-NN.{png,json}
 *
 * The resulting dump is the source of truth for "the car at seed X was in
 * zone Y at t=Ns". Any regression in behaviour shows up as a diff against
 * a prior dump — no ambiguity, no assertion-only opacity.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { expect, type Page, type TestInfo } from '@playwright/test';

export interface PlaythroughOptions {
  /** Deterministic master seed. Passed as ?phrase=... in URL for full reproducibility. */
  phrase: string;
  /** Difficulty tier — forwarded as ?difficulty=. Default 'plenty'. */
  difficulty?: 'kazoo' | 'plenty' | 'nightmare' | 'ultra-nightmare';
  /** Wall-clock time between samples, ms. */
  intervalMs?: number;
  /** Max samples to collect before giving up. */
  maxFrames?: number;
  /** Stop early when text appears. Regex. */
  stopWhen?: RegExp;
  /** Extra query params. */
  extraParams?: Record<string, string>;
}

export interface FrameDump {
  frame: number;
  elapsedMs: number;
  diag: Record<string, unknown> | null;
  screenshotPath: string;
}

/**
 * Run a deterministic autoplay playthrough and dump interval samples.
 * Returns the collected frames so callers can assert on them.
 */
export async function runPlaythrough(
  page: Page,
  testInfo: TestInfo,
  opts: PlaythroughOptions,
): Promise<FrameDump[]> {
  const {
    phrase,
    difficulty = 'plenty',
    intervalMs = 2000,
    maxFrames = 30,
    stopWhen,
    extraParams = {},
  } = opts;

  // Build URL with governor + autoplay + deterministic phrase.
  const params = new URLSearchParams({
    autoplay: '1',
    governor: '1',
    phrase,
    difficulty,
    ...extraParams,
  });
  const url = `/midway-mayhem/?${params.toString()}`;

  const outDir = join(testInfo.outputDir, 'playthrough', encodeURIComponent(phrase));
  await mkdir(outDir, { recursive: true });

  const consoleErrors: string[] = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  await page.goto(url);
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 20_000 });

  const start = Date.now();
  const frames: FrameDump[] = [];

  for (let i = 0; i < maxFrames; i++) {
    await page.waitForTimeout(intervalMs);
    const elapsedMs = Date.now() - start;

    const diag = await page.evaluate(() => {
      const w = window as { __mm?: { diag?: () => unknown } };
      try {
        return (w.__mm?.diag?.() as Record<string, unknown>) ?? null;
      } catch {
        return null;
      }
    });

    const pngName = `frame-${String(i).padStart(2, '0')}.png`;
    const jsonName = `frame-${String(i).padStart(2, '0')}.json`;
    const pngPath = join(outDir, pngName);
    const jsonPath = join(outDir, jsonName);

    await page.screenshot({ type: 'png', path: pngPath });
    await writeFile(
      jsonPath,
      JSON.stringify({ frame: i, elapsedMs, phrase, difficulty, diag }, null, 2),
    );

    frames.push({ frame: i, elapsedMs, diag, screenshotPath: pngPath });

    // Early-exit check
    if (stopWhen) {
      const matched = await page
        .getByText(stopWhen)
        .first()
        .isVisible()
        .catch(() => false);
      if (matched) {
        break;
      }
    }
  }

  // Persist the full summary + any fatal console errors.
  const fatal = filterFatal(consoleErrors);
  await writeFile(
    join(outDir, 'summary.json'),
    JSON.stringify(
      {
        phrase,
        difficulty,
        intervalMs,
        frameCount: frames.length,
        fatalErrors: fatal,
        firstDiag: frames[0]?.diag ?? null,
        lastDiag: frames[frames.length - 1]?.diag ?? null,
      },
      null,
      2,
    ),
  );

  if (fatal.length > 0) {
    throw new Error(`fatal console errors during playthrough ${phrase}:\n${fatal.join('\n')}`);
  }

  return frames;
}

/** Harmless console noise that shouldn't fail tests. */
function filterFatal(errs: string[]): string[] {
  return errs.filter(
    (e) =>
      !e.includes('React DevTools') &&
      !e.toLowerCase().includes('download the react devtools') &&
      !e.includes('TitleScreen.loadTickets') &&
      !e.includes('OPFS') &&
      !e.includes('operation failed for an unknown transient reason'),
  );
}

/** Ensure output dir exists (helper). */
export async function ensureDir(path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
}
