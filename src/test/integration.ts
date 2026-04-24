/**
 * Shared helpers for the App-level integration test suite.
 *
 * Centralizes: typed access to window.__mm.diag(), button finders,
 * drive-flow click chain, and spin-waits for the DropIntro gate.
 *
 * All integration tests import from this barrel instead of poking at
 * raw window internals or redeclaring ambient types per file.
 */
import { waitFor } from '@testing-library/react';
import type { DiagnosticsDump } from '@/game/diagnosticsBus';
import { waitFrames } from './scene';

/** Typed handle to the diag bus installed by installDiagnosticsBus(). */
export function diag(): DiagnosticsDump {
  const snap = window.__mm?.diag?.();
  if (!snap) {
    throw new Error(
      '[integration] window.__mm.diag is not installed — did installDiagnosticsBus() run?',
    );
  }
  return snap;
}

/** Dispatch a heavy or light crash through the exposed __mm bus. */
export function crash(heavy = false): void {
  const fn = window.__mm?.crash;
  if (!fn) throw new Error('[integration] window.__mm.crash is not wired');
  fn(heavy);
}

/** Apply a pickup of the given kind through the exposed __mm bus. */
export function pickup(kind: 'ticket' | 'boost' | 'mega'): void {
  const fn = window.__mm?.pickup;
  if (!fn) throw new Error('[integration] window.__mm.pickup is not wired');
  fn(kind);
}

/** Set steering input (-1 full-left … +1 full-right) through __mm bus. */
export function setSteer(v: number): void {
  const fn = window.__mm?.setSteer;
  if (!fn) throw new Error('[integration] window.__mm.setSteer is not wired');
  fn(v);
}

/** Pause the active run through the exposed __mm bus. */
export function pause(): void {
  const fn = window.__mm?.pause;
  if (!fn) throw new Error('[integration] window.__mm.pause is not wired');
  fn();
}

/** Resume a paused run through the exposed __mm bus. */
export function resume(): void {
  const fn = window.__mm?.resume;
  if (!fn) throw new Error('[integration] window.__mm.resume is not wired');
  fn();
}

/** Fire a CROWD CHAIN combo event (scare / pickup / near-miss). */
export function comboEvent(kind: 'scare' | 'pickup' | 'near-miss'): void {
  const fn = window.__mm?.comboEvent;
  if (!fn) throw new Error('[integration] window.__mm.comboEvent is not wired');
  fn(kind);
}

/** End the current run through the exposed __mm bus. */
export function endRun(): void {
  const fn = window.__mm?.end;
  if (!fn) throw new Error('[integration] window.__mm.end is not wired');
  fn();
}

/** Find a DOM button whose text content matches `re`, or null. */
export function findButton(root: ParentNode, re: RegExp): HTMLButtonElement | null {
  const buttons = Array.from(root.querySelectorAll('button')) as HTMLButtonElement[];
  return buttons.find((b) => re.test((b.textContent || '').trim())) ?? null;
}

/** waitFor a button matching `re` — throws a named error on timeout. */
export async function waitForButton(
  root: ParentNode,
  re: RegExp,
  label: string,
  timeoutMs = 5_000,
): Promise<HTMLButtonElement> {
  return waitFor(
    () => {
      const b = findButton(root, re);
      if (!b) throw new Error(`[integration] button "${label}" not yet mounted`);
      return b;
    },
    { timeout: timeoutMs },
  );
}

/**
 * Click through the full title → difficulty → DRIVE flow and wait past
 * the drop-in intro so the gameplay tick is actually advancing.
 *
 * @param root  The testing-library container to search for buttons.
 * @param tier  Regex matching the difficulty tier label.
 */
export async function driveInto(root: ParentNode, tier: RegExp = /KAZOO/i): Promise<void> {
  const newRun = await waitForButton(root, /^\s*NEW\s+RUN\s*$/i, 'NEW RUN');
  newRun.click();

  const tierBtn = await waitForButton(root, tier, `difficulty ${tier}`);
  tierBtn.click();

  const play = await waitForButton(root, /▶\s*PLAY/, 'PLAY');
  play.click();

  await waitPastDropIn();
}

/**
 * CI runs headless Chrome with swiftshader (software WebGL) which is 3-5×
 * slower than real-GPU chrome. Tests that wait for distance to accumulate
 * use this multiplier so local dev stays fast but CI has enough budget.
 * Vite injects VITE_CI at build time when it's on the environment.
 */
const CI_TIME_MULTIPLIER = (import.meta.env as Record<string, unknown>).VITE_CI ? 5 : 1;

/** Spin until DropIntro.dropProgress hits 1 so tickGameState advances. */
export async function waitPastDropIn(timeoutMs = 10_000): Promise<void> {
  await waitFor(
    () => {
      const p = diag().dropProgress;
      if (p < 1) throw new Error(`[integration] drop-in at ${p.toFixed(2)}, waiting`);
    },
    { timeout: timeoutMs * CI_TIME_MULTIPLIER, interval: 50 },
  );
}

/** Spin until diag().distance > `metres`, up to `timeoutMs` (scaled on CI). */
export async function waitForDistance(metres: number, timeoutMs = 20_000): Promise<void> {
  await waitFor(
    () => {
      const d = diag().distance;
      if (d < metres) throw new Error(`[integration] distance ${d.toFixed(0)}m < ${metres}m`);
    },
    { timeout: timeoutMs * CI_TIME_MULTIPLIER, interval: 100 },
  );
}

/** re-export for tests that already have a waitFrames dep. */
export { waitFrames };
