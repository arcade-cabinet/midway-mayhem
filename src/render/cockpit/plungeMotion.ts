/**
 * Plunge motion math — a pure module so the free-fall curve can be unit-tested
 * without standing up the full R3F stack.
 *
 * When the player drives off the side of a rail-free ramp, the cockpit (camera
 * + hood group) FALLS past the still-rendered track geometry, rather than
 * fading or teleporting. The user literally sees the track rise above them as
 * they drop — which is only possible if the TRACK stays put in world space
 * and the COCKPIT moves down.
 *
 * Physics:
 *   y(t) = -0.5 * g * t^2                           (classic free fall)
 *   x(t) = direction * LATERAL_SLIDE_MPS * t        (they keep sliding sideways)
 *   roll(t), pitch(t) tip over the edge so you see the track whip past overhead
 */

/** m/s² — Earth-surface gravitational acceleration used for the plunge. */
export const PLUNGE_GRAVITY_MPS2 = 9.8;

/** m/s — how fast the cockpit continues to slide in the plunge direction. */
export const PLUNGE_LATERAL_SLIDE_MPS = 6;

/** rad/s — how fast the cockpit pitches forward while falling. */
export const PLUNGE_PITCH_RATE = 0.9;

/** rad/s — roll rate in the plunge direction. */
export const PLUNGE_ROLL_RATE = 0.6;

export interface PlungeOffset {
  /** Lateral offset (world X) — sign = plungeDirection. */
  x: number;
  /** Vertical offset (world Y) — always ≤ 0, strictly decreasing once t>0. */
  y: number;
  /** Pitch (rotation about X) forward as the car tips over the edge. */
  rotX: number;
  /** Roll (rotation about Z) in the direction of the plunge. */
  rotZ: number;
}

/**
 * Compute the cockpit's offset from its nominal drop-in resting pose, at
 * `elapsedSeconds` into the plunge window.
 *
 * @param elapsedSeconds seconds since plungeStartedAt (clamped at 0)
 * @param plungeDirection sign of lateral at plunge-start (±1)
 */
export function computePlungeOffset(elapsedSeconds: number, plungeDirection: number): PlungeOffset {
  const t = Math.max(0, elapsedSeconds);
  const dir = Math.sign(plungeDirection) || 1;
  return {
    x: dir * PLUNGE_LATERAL_SLIDE_MPS * t,
    y: -0.5 * PLUNGE_GRAVITY_MPS2 * t * t,
    rotX: PLUNGE_PITCH_RATE * t,
    rotZ: dir * PLUNGE_ROLL_RATE * t,
  };
}
