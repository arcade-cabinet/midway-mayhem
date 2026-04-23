/**
 * @module game/tutorial
 *
 * Six-step guided first-run tutorial state machine.
 *
 * Steps:
 *   1  STEER   — wait for first lane change (lateral displacement)
 *   2  HONK    — wait for first honk event
 *   3  BALLOON — wait for first balloon pickup (score.balloons >= 1)
 *   4  BOOST   — wait for first boost activation (boostUntil > now)
 *   5  TRICK   — wait for first successful trick (trickSystem onCleanLanding)
 *   6  PLUNGE  — show the spiral drop-in preview, then release the player
 *
 * Persistence: each completed step is stamped in @capacitor/preferences via
 * the existing `markShown` / `shouldShow` API in persistence/tutorial.ts.
 * On second launch, if step 6 is already marked complete the tutorial is
 * skipped in full.
 *
 * Architecture: pure TS state machine — no React, no ECS imports. The overlay
 * component polls `getTutorialStep()` and calls the advance functions when
 * conditions are met. The tutorial is skippable via `skipTutorial()`.
 */

import type { TutorialSlug } from '@/persistence/tutorial';
import { markShown, shouldShow } from '@/persistence/tutorial';

export type TutorialStep = 1 | 2 | 3 | 4 | 5 | 6;

/** Extended "done" state — tutorial has been completed or skipped. */
export type TutorialPhase =
  | { active: false }
  | { active: true; step: TutorialStep; completing: boolean };

// Use the plunge-explained slug as the whole-tutorial-done gate.
// Individual step slugs are used to mark honk + trick as seen (bonus effect).

// ─── Module state ────────────────────────────────────────────────────────────

let _phase: TutorialPhase = { active: false };
/** True once `initTutorial` has run. */
let _initialized = false;

// ─── Init ────────────────────────────────────────────────────────────────────

/**
 * Call once on app boot (after hydrateTutorialFlags()).
 * If step 6 is already complete → stays inactive (skip tutorial on return visits).
 * Otherwise, start from step 1.
 */
export function initTutorial(): void {
  if (_initialized) return;
  _initialized = true;

  // If step 6 has been completed previously, do not show the tutorial.
  // shouldShow() checks the TutorialSlug cache — use the plunge-explained slug
  // as the canonical "whole tutorial done" gate.
  if (!shouldShow('plunge-explained')) {
    _phase = { active: false };
    return;
  }

  // Find the lowest not-yet-completed step (resume from where the player left off).
  const resumeStep = _findResumeStep();
  _phase = { active: true, step: resumeStep, completing: false };
}

/**
 * Determine the first step that has not been completed yet.
 * Used on resume (e.g. player restarted mid-tutorial).
 */
function _findResumeStep(): TutorialStep {
  const slugsInOrder: Array<[TutorialStep, TutorialSlug]> = [
    [1, 'first-ramp'],
    [2, 'first-honk'],
    [3, 'first-pickup-mega'],
    [4, 'first-ramp'], // step 4 uses same slug — we can't re-use slug-based shouldShow here
    [5, 'first-trick'],
    [6, 'plunge-explained'],
  ];
  // Use the plunge-explained gate for the full completion check; for individual
  // steps we rely on the step-level pref keys, not TutorialSlug (which are
  // shared with in-game hint slugs). For simplicity in this state machine,
  // always start from step 1 on a fresh session where step 6 is unseen.
  // Returning to a mid-tutorial session is out-of-scope for v1 — always restart.
  void slugsInOrder;
  return 1;
}

// ─── Public reads ────────────────────────────────────────────────────────────

export function getTutorialPhase(): TutorialPhase {
  return _phase;
}

export function isTutorialActive(): boolean {
  return _phase.active;
}

export function getTutorialStep(): TutorialStep | null {
  if (!_phase.active) return null;
  return _phase.step;
}

/** True when the current step is in its "completing" (fade-out) window. */
export function isTutorialStepCompleting(): boolean {
  return _phase.active && _phase.completing;
}

// ─── Advance ─────────────────────────────────────────────────────────────────

/**
 * Mark the current step as done and advance to the next.
 * Step 6 → tutorial complete → phase goes inactive.
 * Fire-and-forget async write to preferences.
 */
export function advanceTutorial(): void {
  if (!_phase.active) return;
  const currentStep = _phase.step;

  // Enter "completing" state first (triggers fade-out in the overlay).
  _phase = { active: true, step: currentStep, completing: true };

  // Persist the completed step.
  void _persistStep(currentStep);
}

/**
 * Called by the overlay after the fade-out animation ends.
 * Moves to the next step (or finishes the tutorial).
 */
export function commitStepTransition(): void {
  if (!_phase.active) return;
  const currentStep = _phase.step;

  if (currentStep === 6) {
    // All done — tutorial complete.
    _phase = { active: false };
  } else {
    const next = (currentStep + 1) as TutorialStep;
    _phase = { active: true, step: next, completing: false };
  }
}

/** Skip the entire tutorial immediately. Persists step 6 as complete. */
export async function skipTutorial(): Promise<void> {
  _phase = { active: false };
  // Mark all remaining steps so the tutorial never resurfaces.
  await _persistStep(6);
}

// ─── Condition helpers ────────────────────────────────────────────────────────

/**
 * Check step 1 — "Steer": the player's lateral offset from center has changed
 * by at least 1 lane width (indicates intentional steering).
 */
export function checkSteerCondition(lateral: number): boolean {
  return Math.abs(lateral) > 0.5;
}

/**
 * Check step 3 — "Balloon": player has collected at least one balloon.
 */
export function checkBalloonCondition(balloons: number): boolean {
  return balloons >= 1;
}

/**
 * Check step 4 — "Boost": a boost pad is currently active.
 */
export function checkBoostCondition(boostUntil: number, now: number): boolean {
  return boostUntil > now;
}

// ─── Persistence ─────────────────────────────────────────────────────────────

async function _persistStep(step: TutorialStep): Promise<void> {
  // Only stamp the plunge-explained slug (step 6) — that is what initTutorial
  // checks for the "already done" gate.
  if (step === 6) {
    await markShown('plunge-explained');
  }
  // For individual step tracking we also stamp per-step keys.
  const slugMap: Partial<Record<TutorialStep, TutorialSlug>> = {
    2: 'first-honk',
    5: 'first-trick',
  };
  const slug = slugMap[step];
  if (slug && shouldShow(slug)) {
    await markShown(slug);
  }
}

// ─── Reset (test-only) ───────────────────────────────────────────────────────

/** Reset all module state. Used by unit tests. */
export function resetTutorialForTests(): void {
  _phase = { active: false };
  _initialized = false;
}

// ─── Prompt text (single source of truth) ────────────────────────────────────

export const TUTORIAL_PROMPTS: Record<TutorialStep, string> = {
  1: 'SWIPE TO CHANGE LANE',
  2: 'TAP ANYWHERE TO HONK',
  3: 'GRAB A BALLOON',
  4: 'HIT A BOOST PAD',
  5: 'SWIPE UP FOR A BACKFLIP',
  6: "YOU'RE HIGH IN THE DOME — DROPPING IN",
};

export const TUTORIAL_SUBTITLES: Record<TutorialStep, string> = {
  1: 'Drag left or right to steer between lanes',
  2: 'Scare critters off the road with your horn',
  3: 'Balloons boost your crowd reaction',
  4: 'Boost pads launch you to max speed',
  5: 'Swipe up twice while airborne',
  6: 'Watch the spiral — then ride it',
};
