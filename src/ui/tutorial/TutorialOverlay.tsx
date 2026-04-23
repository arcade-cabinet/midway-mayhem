/**
 * @module ui/tutorial/TutorialOverlay
 *
 * Contextual prompt card rendered at the top of the viewport during the
 * 6-step tutorial. Reads the current tutorial step from the tutorial state
 * machine and displays the matching prompt + subtitle.
 *
 * Behaviour:
 *   - Fades in immediately when a new step activates.
 *   - Fades out over 1s when the step enters "completing" state.
 *   - After fade-out, calls `onStepFadeOut()` so the parent can call
 *     `commitStepTransition()`.
 *   - "SKIP TUTORIAL" button calls `skipTutorial()` and notifies `onSkip`.
 *
 * Brand: yellow background card, red text, Bangers display font.
 */
import { useEffect, useRef, useState } from 'react';
import { color } from '@/design/tokens';
import { font } from '@/design/typography';
import {
  getTutorialPhase,
  isTutorialStepCompleting,
  skipTutorial,
  TUTORIAL_PROMPTS,
  TUTORIAL_SUBTITLES,
  type TutorialStep,
} from '@/game/tutorial';

const FADE_OUT_MS = 1000;

interface TutorialOverlayProps {
  /** Called after the fade-out animation ends — parent should call commitStepTransition(). */
  onStepFadeOut: () => void;
  /** Called when the player taps "Skip tutorial". */
  onSkip: () => void;
}

export function TutorialOverlay({ onStepFadeOut, onSkip }: TutorialOverlayProps) {
  const phase = getTutorialPhase();
  const [opacity, setOpacity] = useState(0);
  const [visible, setVisible] = useState(false);
  // Local skip flag — immediately hides the overlay on "Skip tutorial" click
  // before the parent has a chance to unmount us.
  const [skipped, setSkipped] = useState(false);
  const prevStepRef = useRef<TutorialStep | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive = phase.active && !skipped;
  const step: TutorialStep | null = phase.active && !skipped ? phase.step : null;
  const completing = isTutorialStepCompleting();

  // Fade in when we get a new active step.
  useEffect(() => {
    if (!isActive || step === null) {
      setVisible(false);
      setOpacity(0);
      return;
    }

    // New step arrived (or first mount)
    if (step !== prevStepRef.current) {
      prevStepRef.current = step;
      setVisible(true);
      // Trigger fade-in on next frame
      const id = setTimeout(() => setOpacity(1), 30);
      return () => clearTimeout(id);
    }

    return undefined;
  }, [isActive, step]);

  // Fade out when the current step enters "completing" state.
  useEffect(() => {
    if (!completing) return;

    setOpacity(0);

    if (fadeTimerRef.current !== null) clearTimeout(fadeTimerRef.current);
    fadeTimerRef.current = setTimeout(() => {
      setVisible(false);
      onStepFadeOut();
    }, FADE_OUT_MS);

    return () => {
      if (fadeTimerRef.current !== null) clearTimeout(fadeTimerRef.current);
    };
  }, [completing, onStepFadeOut]);

  if (!visible || step === null) return null;

  const prompt = TUTORIAL_PROMPTS[step];
  const subtitle = TUTORIAL_SUBTITLES[step];

  const isStep6 = step === 6;

  return (
    <div
      data-testid="tutorial-overlay"
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
        opacity,
        transition: `opacity ${FADE_OUT_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        pointerEvents: 'none',
        width: 'min(92vw, 520px)',
      }}
    >
      <div
        data-testid="tutorial-card"
        style={{
          background: isStep6 ? color.night : color.yellow,
          border: `3px solid ${color.red}`,
          borderRadius: 12,
          padding: '14px 20px 12px',
          textAlign: 'center',
          boxShadow: isStep6 ? '0 8px 32px rgba(255,214,0,0.4)' : '0 4px 20px rgba(0,0,0,0.55)',
          position: 'relative',
        }}
      >
        {/* Step indicator pill */}
        <div
          data-testid="tutorial-step-indicator"
          style={{
            position: 'absolute',
            top: -12,
            left: '50%',
            transform: 'translateX(-50%)',
            background: color.red,
            color: color.yellow,
            fontFamily: font.display,
            fontSize: '0.85rem',
            letterSpacing: '0.1em',
            padding: '2px 12px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
          {`STEP ${step} OF 6`}
        </div>

        {/* Main prompt */}
        <div
          data-testid="tutorial-prompt"
          style={{
            fontFamily: font.display,
            fontSize: 'clamp(1.4rem, 5vw, 2.2rem)',
            letterSpacing: '0.06em',
            lineHeight: 1,
            color: isStep6 ? color.yellow : color.red,
            marginTop: 8,
          }}
        >
          {prompt}
        </div>

        {/* Subtitle */}
        <div
          data-testid="tutorial-subtitle"
          style={{
            fontFamily: font.ui,
            fontSize: 'clamp(0.75rem, 2vw, 0.9rem)',
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: isStep6 ? 'rgba(255,255,255,0.75)' : 'rgba(11,15,26,0.75)',
            marginTop: 4,
          }}
        >
          {subtitle}
        </div>

        {/* Skip button — rendered with pointer-events restored */}
        <div style={{ pointerEvents: 'auto', marginTop: 10 }}>
          <button
            type="button"
            data-testid="tutorial-skip"
            onClick={() => {
              setSkipped(true);
              setVisible(false);
              void skipTutorial();
              onSkip();
            }}
            style={{
              background: 'transparent',
              border: `1px solid ${isStep6 ? 'rgba(255,214,0,0.4)' : 'rgba(11,15,26,0.3)'}`,
              borderRadius: 6,
              padding: '4px 14px',
              fontFamily: font.ui,
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: isStep6 ? 'rgba(255,214,0,0.7)' : 'rgba(11,15,26,0.55)',
              cursor: 'pointer',
            }}
          >
            Skip tutorial
          </button>
        </div>
      </div>
    </div>
  );
}
