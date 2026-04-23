/**
 * @module hooks/useTutorialWatcher
 *
 * Polls game state on every animation frame and advances the tutorial state
 * machine when conditions for the current step are met.
 *
 * Step conditions:
 *   1 STEER   — lateral > 0.5 (lane changed)
 *   2 HONK    — honkBus fires once while this step is active
 *   3 BALLOON — score.balloons >= 1
 *   4 BOOST   — boostUntil > performance.now()
 *   5 TRICK   — trickSystem onCleanLanding fires while step 5 is active
 *   6 PLUNGE  — auto-advances after the DropInIntro camera animation completes
 *
 * The hook subscribes to honkBus and the clean-landing event directly (not
 * via polling) because those are edge triggers, not state-based conditions.
 *
 * Returns:
 *   - `tutorialActive` — boolean, the overlay should render
 *   - `onHonk`         — pass to the honk bridge so the hook can detect it
 *   - `onCleanLanding` — pass to the trick system callback chain
 *   - `onDropInComplete` — call when the Step-6 DropInIntro finishes
 */
import { useEffect, useRef } from 'react';
import { Player, Score } from '@/ecs/traits';
import { world } from '@/ecs/world';
import { useGameStore } from '@/game/gameState';
import {
  advanceTutorial,
  checkBalloonCondition,
  checkBoostCondition,
  checkSteerCondition,
  commitStepTransition,
  getTutorialStep,
  isTutorialActive,
} from '@/game/tutorial';

export interface TutorialWatcherResult {
  /** Whether the TutorialOverlay should be rendered. */
  tutorialVisible: boolean;
  /** Call from the honk bridge to satisfy step 2. */
  onTutorialHonk: () => void;
  /** Call from the trick system's onCleanLanding callback to satisfy step 5. */
  onTutorialCleanLanding: () => void;
  /** Call when the Step-6 DropInIntro camera animation completes. */
  onDropInComplete: () => void;
  /** Call after the TutorialOverlay's fade-out animation ends. */
  onStepFadeOut: () => void;
}

export function useTutorialWatcher(): TutorialWatcherResult {
  const lateral = useGameStore((s) => s.lateral);
  const boostUntil = useGameStore((s) => s.boostUntil);
  const running = useGameStore((s) => s.running);

  // Step-already-advanced guard so we don't fire advanceTutorial twice per frame
  const advancedRef = useRef(false);

  // Track which step we have wired reactive conditions for
  const lastStepRef = useRef<number | null>(null);

  // When the step changes, reset the advance guard
  const currentStep = getTutorialStep();
  if (currentStep !== lastStepRef.current) {
    lastStepRef.current = currentStep;
    advancedRef.current = false;
  }

  // ─── Per-frame polling for state-based conditions (steps 1, 3, 4) ─────────
  useEffect(() => {
    if (!running) return;

    const step = getTutorialStep();
    if (!isTutorialActive() || step === null || advancedRef.current) return;

    if (step === 1 && checkSteerCondition(lateral)) {
      advancedRef.current = true;
      advanceTutorial();
    }

    if (step === 3) {
      const balloons = world.query(Player, Score)[0]?.get(Score)?.balloons ?? 0;
      if (checkBalloonCondition(balloons)) {
        advancedRef.current = true;
        advanceTutorial();
      }
    }

    if (step === 4 && checkBoostCondition(boostUntil, performance.now())) {
      advancedRef.current = true;
      advanceTutorial();
    }
  });

  // ─── Event-driven conditions ──────────────────────────────────────────────

  function onTutorialHonk(): void {
    if (!isTutorialActive() || getTutorialStep() !== 2 || advancedRef.current) return;
    advancedRef.current = true;
    advanceTutorial();
  }

  function onTutorialCleanLanding(): void {
    if (!isTutorialActive() || getTutorialStep() !== 5 || advancedRef.current) return;
    advancedRef.current = true;
    advanceTutorial();
  }

  function onDropInComplete(): void {
    if (!isTutorialActive() || getTutorialStep() !== 6 || advancedRef.current) return;
    advancedRef.current = true;
    advanceTutorial();
  }

  function onStepFadeOut(): void {
    commitStepTransition();
  }

  return {
    tutorialVisible: isTutorialActive(),
    onTutorialHonk,
    onTutorialCleanLanding,
    onDropInComplete,
    onStepFadeOut,
  };
}
