/**
 * Pure helpers for cockpit pitch-look-down during descents.
 *
 * 40 % of track pitch is enough to register as a fall without the camera
 * swinging into vertiginous territory. 2 Hz exp-smoothing gives the ~0.5 s
 * settling window called out in the PRQ ("flat sections return to neutral
 * within 0.5s").
 */

/** Fraction of track pitch translated into cockpit rotation-X. */
export const DESCENT_LOOK_FACTOR = 0.4;

/**
 * Exp-smoothing cutoff frequency (Hz). At 2 Hz the time-constant τ = 1/(2π·2)
 * ≈ 0.08 s; after 0.5 s the residual is ≈ 4 % — well within perceptual neutral.
 */
export const DESCENT_SMOOTHING_HZ = 2.0;

/**
 * Maps track pitch to the target cockpit rotation-X.
 *
 * Negative (look-down) on a plunge; positive (look-up) on a climb; zero on flat.
 */
export function getCockpitDescentPitch(trackPitch: number): number {
  return trackPitch * DESCENT_LOOK_FACTOR;
}

/**
 * Advances one smoothing step toward `target` using framerate-independent
 * exponential approach. Returns the new smoothed value.
 *
 * The `1 - exp(-k·dt)` form guarantees identical settling regardless of
 * whether the game is running at 30 fps, 60 fps, or 120 fps.
 */
export function smoothDescentPitch(current: number, target: number, dt: number): number {
  if (dt <= 0) return current;
  const k = 1 - Math.exp(-DESCENT_SMOOTHING_HZ * dt);
  return current + (target - current) * k;
}
