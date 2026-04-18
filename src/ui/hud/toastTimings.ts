/**
 * Toast animation timing helpers.
 * Centralises the numeric offsets so AchievementToast (.tsx) stays render-only.
 */

export interface ToastTimings {
  /** Delay before slide-in starts (ms). */
  enterDelay: number;
  /** Delay before slide-out starts (ms). */
  exitDelay: number;
  /** Delay before clearing the current toast (ms). */
  clearDelay: number;
}

export function computeToastTimings(toastDurationMs: number): ToastTimings {
  return {
    enterDelay: 16,
    exitDelay: toastDurationMs - 400,
    clearDelay: toastDurationMs,
  };
}
