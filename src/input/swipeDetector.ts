/**
 * Flick-style swipe detector.
 *
 * A swipe is a fast horizontal gesture — the gesture vocabulary is a lane
 * change, NOT a continuous steer. "Slow drag" and "vertical swipe" must
 * produce null so the player can brace their thumb without accidentally
 * changing lanes.
 *
 * Tuning lives here, not in tunables.json, because these are perceptual
 * constants (human motor control, not game balance). They are exported so
 * browser tests can verify the thresholds haven't been silently changed.
 */

export type SwipeDirection = 'left' | 'right';

/**
 * A pointer event snapshot consumed by the detector. Using a minimal
 * interface keeps the detector testable without a DOM.
 */
export interface SwipePoint {
  pointerId: number;
  clientX: number;
  clientY: number;
  timeStamp: number;
}

/** Minimum horizontal travel (px) before we call it a swipe. */
export const SWIPE_MIN_DIST_PX = 28;

/**
 * Minimum horizontal velocity (px/ms) for the gesture to count as a flick.
 * A deliberate poke at ~40 ms registers; a slow hold-and-drag does not.
 */
export const SWIPE_MIN_VELOCITY_PX_MS = 0.35;

/**
 * Maximum angle from horizontal (degrees) before the gesture is considered
 * vertical-dominant and ignored.
 */
export const SWIPE_MAX_ANGLE_DEG = 40;

const DEG_TO_RAD = Math.PI / 180;

/**
 * Given the first and last pointer positions for a single gesture, returns
 * which lane-change direction was intended — or null if the gesture doesn't
 * qualify as a discrete swipe.
 *
 * Constraints enforced:
 *  - Must travel at least SWIPE_MIN_DIST_PX horizontally.
 *  - Horizontal velocity must exceed SWIPE_MIN_VELOCITY_PX_MS so slow
 *    drags are not mistaken for flicks.
 *  - The gesture angle from horizontal must be within SWIPE_MAX_ANGLE_DEG so
 *    vertical swipes (that might be scroll attempts) are silently ignored.
 *
 * @param start - PointerDown snapshot.
 * @param end   - PointerUp snapshot for the same pointerId.
 */
export function detectSwipe(start: SwipePoint, end: SwipePoint): SwipeDirection | null {
  const dx = end.clientX - start.clientX;
  const dy = end.clientY - start.clientY;
  const dt = end.timeStamp - start.timeStamp;

  if (Math.abs(dx) < SWIPE_MIN_DIST_PX) return null;

  if (dt <= 0) return null;
  const vx = Math.abs(dx) / dt;
  if (vx < SWIPE_MIN_VELOCITY_PX_MS) return null;

  // Reject vertical-dominant gestures — angle measured from the X-axis.
  const angleDeg = Math.abs(Math.atan2(Math.abs(dy), Math.abs(dx)) / DEG_TO_RAD);
  if (angleDeg > SWIPE_MAX_ANGLE_DEG) return null;

  return dx < 0 ? 'left' : 'right';
}
