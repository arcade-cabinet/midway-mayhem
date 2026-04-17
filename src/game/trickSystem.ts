/**
 * TrickSystem — Feature C.
 *
 * Detects airborne state from ramp launches, buffers directional inputs,
 * recognizes trick sequences, and computes rotation + landing reward/penalty.
 *
 * Tricks:
 *   BARREL_ROLL  right-right | left-left  → full 360° Z rotation
 *   WHEELIE      up-up                    → nose-up 60° X rotation
 *   HANDSTAND    down-down               → nose-down 180° X rotation
 *   SPIN_180     left-right | right-left  → 180° Y rotation
 */

export type TrickInput = 'left' | 'right' | 'up' | 'down';
export type TrickKind = 'BARREL_ROLL' | 'WHEELIE' | 'HANDSTAND' | 'SPIN_180';

export interface TrickResult {
  kind: TrickKind;
  /** Target rotation axis and total angle (radians) */
  axis: 'z' | 'x' | 'y';
  totalAngle: number; // radians
  duration: number; // seconds
}

export interface TrickState {
  airborne: boolean;
  inputBuffer: TrickInput[];
  currentTrick: TrickResult | null;
  trickProgress: number; // 0–1 progress through animation
  trickStartedAt: number; // performance.now()
  /** Accumulated rotation for cockpit-root (Z, X, Y offsets applied to rootRef) */
  rotZ: number;
  rotX: number;
  rotY: number;
}

/** Sequence → TrickResult mapping */
const TRICK_MAP: { sequence: TrickInput[]; result: TrickResult }[] = [
  {
    sequence: ['right', 'right'],
    result: { kind: 'BARREL_ROLL', axis: 'z', totalAngle: Math.PI * 2, duration: 0.8 },
  },
  {
    sequence: ['left', 'left'],
    result: { kind: 'BARREL_ROLL', axis: 'z', totalAngle: -Math.PI * 2, duration: 0.8 },
  },
  {
    sequence: ['up', 'up'],
    result: { kind: 'WHEELIE', axis: 'x', totalAngle: -Math.PI / 3, duration: 1.0 },
  },
  {
    sequence: ['down', 'down'],
    result: { kind: 'HANDSTAND', axis: 'x', totalAngle: Math.PI, duration: 1.2 },
  },
  {
    sequence: ['left', 'right'],
    result: { kind: 'SPIN_180', axis: 'y', totalAngle: Math.PI, duration: 0.7 },
  },
  {
    sequence: ['right', 'left'],
    result: { kind: 'SPIN_180', axis: 'y', totalAngle: -Math.PI, duration: 0.7 },
  },
];

/** Tolerance in radians for clean landing (15°) */
const CLEAN_LANDING_TOLERANCE = (15 * Math.PI) / 180;

/** Sanity reward for a clean landing */
export const CLEAN_SANITY_REWARD = 15;
/** Crowd reward for a clean landing */
export const CLEAN_CROWD_REWARD = 150;

export function recognizeTrick(buffer: TrickInput[]): TrickResult | null {
  // Try matching the last 2 inputs
  const last2 = buffer.slice(-2);
  if (last2.length < 2) return null;
  for (const { sequence, result } of TRICK_MAP) {
    if (last2[0] === sequence[0] && last2[1] === sequence[1]) {
      return result;
    }
  }
  return null;
}

/** Returns how far the rotation is from neutral (0) on the given axis. */
export function landingDeviation(
  rotZ: number,
  rotX: number,
  rotY: number,
  axis: 'z' | 'x' | 'y',
): number {
  const rot = axis === 'z' ? rotZ : axis === 'x' ? rotX : rotY;
  // Normalize to [-π, π]
  let angle = rot % (Math.PI * 2);
  if (angle > Math.PI) angle -= Math.PI * 2;
  if (angle < -Math.PI) angle += Math.PI * 2;
  return Math.abs(angle);
}

export function isCleanLanding(rotZ: number, rotX: number, rotY: number): boolean {
  const zDev = Math.abs(rotZ % (Math.PI * 2));
  const xDev = Math.abs(rotX % (Math.PI * 2));
  const yDev = Math.abs(rotY % (Math.PI * 2));
  const zNorm = zDev > Math.PI ? Math.PI * 2 - zDev : zDev;
  const xNorm = xDev > Math.PI ? Math.PI * 2 - xDev : xDev;
  const yNorm = yDev > Math.PI ? Math.PI * 2 - yDev : yDev;
  return (
    zNorm < CLEAN_LANDING_TOLERANCE &&
    xNorm < CLEAN_LANDING_TOLERANCE &&
    yNorm < CLEAN_LANDING_TOLERANCE
  );
}

export class TrickSystem {
  private state: TrickState = {
    airborne: false,
    inputBuffer: [],
    currentTrick: null,
    trickProgress: 0,
    trickStartedAt: 0,
    rotZ: 0,
    rotX: 0,
    rotY: 0,
  };

  /** Update airborne state and advance trick animation. */
  update(
    nowMs: number,
    airborne: boolean,
    callbacks: {
      onCleanLanding: () => void;
      onBotchedLanding: () => void;
    },
  ) {
    const wasAirborne = this.state.airborne;
    this.state.airborne = airborne;

    // Landing transition
    if (
      wasAirborne &&
      !airborne &&
      (this.state.currentTrick ||
        this.state.rotZ !== 0 ||
        this.state.rotX !== 0 ||
        this.state.rotY !== 0)
    ) {
      const clean = isCleanLanding(this.state.rotZ, this.state.rotX, this.state.rotY);
      if (clean) {
        callbacks.onCleanLanding();
      } else {
        callbacks.onBotchedLanding();
      }
      // Reset rotations on landing
      this.state.rotZ = 0;
      this.state.rotX = 0;
      this.state.rotY = 0;
      this.state.currentTrick = null;
      this.state.trickProgress = 0;
      this.state.inputBuffer = [];
    }

    // Advance trick animation
    const trick = this.state.currentTrick;
    if (trick && this.state.trickStartedAt > 0) {
      const elapsed = (nowMs - this.state.trickStartedAt) / 1000;
      this.state.trickProgress = Math.min(1, elapsed / trick.duration);
      // Smooth step
      const t = this.state.trickProgress;
      const smooth = t * t * (3 - 2 * t);
      const angle = trick.totalAngle * smooth;
      if (trick.axis === 'z') this.state.rotZ = angle;
      else if (trick.axis === 'x') this.state.rotX = angle;
      else this.state.rotY = angle;
    }

    // Snap to final rotation when animation completes
    if (trick && this.state.trickProgress >= 1) {
      if (trick.axis === 'z') this.state.rotZ = trick.totalAngle;
      else if (trick.axis === 'x') this.state.rotX = trick.totalAngle;
      else this.state.rotY = trick.totalAngle;
      this.state.currentTrick = null;
    }
  }

  /** Register a directional input during airborne window. */
  pushInput(input: TrickInput, nowMs: number) {
    if (!this.state.airborne) return;
    // Max buffer = 4
    if (this.state.inputBuffer.length >= 4) this.state.inputBuffer.shift();
    this.state.inputBuffer.push(input);

    // Only start a new trick if none is running
    if (!this.state.currentTrick) {
      const trick = recognizeTrick(this.state.inputBuffer);
      if (trick) {
        this.state.currentTrick = trick;
        this.state.trickStartedAt = nowMs;
        this.state.trickProgress = 0;
        // Reset current axis rotation to 0 before animating
        if (trick.axis === 'z') this.state.rotZ = 0;
        else if (trick.axis === 'x') this.state.rotX = 0;
        else this.state.rotY = 0;
      }
    }
  }

  getState(): Readonly<TrickState> {
    return this.state;
  }

  reset() {
    this.state = {
      airborne: false,
      inputBuffer: [],
      currentTrick: null,
      trickProgress: 0,
      trickStartedAt: 0,
      rotZ: 0,
      rotX: 0,
      rotY: 0,
    };
  }
}
