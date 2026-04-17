/**
 * useWalkControls — first-person walk controls for BigTopTour.
 *
 * Desktop: PointerLock + WASD. Pointer delta drives look; keys drive movement.
 * Mobile:  Two virtual joystick zones rendered by VirtualJoystick component.
 *          Left zone = move (forward/back/strafe), right zone = look (yaw/pitch).
 *
 * Returns per-frame mutable ref objects so callers can consume in useFrame
 * without triggering React re-renders.
 */
import { useEffect, useRef } from 'react';

export interface WalkState {
  forward: number; // -1..1  (positive = forward)
  right: number; // -1..1  (positive = right strafe)
  lookYaw: number; // accumulated radians (world Y rotation)
  lookPitch: number; // clamped ±Math.PI/2.4
}

export interface JoystickInput {
  /** Call from VirtualJoystick when left stick moves (movement: -1..1 axes) */
  setMoveStick(x: number, y: number): void;
  /** Call from VirtualJoystick when right stick moves (look: -1..1 axes) */
  setLookStick(x: number, y: number): void;
}

export interface UseWalkControlsResult {
  state: React.MutableRefObject<WalkState>;
  joystick: JoystickInput;
  /** requestPointerLock on the canvas */
  requestLock(element: HTMLElement): void;
}

const LOOK_SENSITIVITY_MOUSE = 0.0025;
const LOOK_SENSITIVITY_STICK = 0.04;
const PITCH_LIMIT = Math.PI / 2.4;

export function useWalkControls(): UseWalkControlsResult {
  const state = useRef<WalkState>({
    forward: 0,
    right: 0,
    lookYaw: 0,
    lookPitch: 0,
  });

  // Joystick state (raw -1..1)
  const moveStick = useRef({ x: 0, y: 0 });
  const lookStick = useRef({ x: 0, y: 0 });

  const joystick: JoystickInput = {
    setMoveStick(x, y) {
      moveStick.current = { x, y };
    },
    setLookStick(x, y) {
      lookStick.current = { x, y };
    },
  };

  useEffect(() => {
    const keys = new Set<string>();

    const onKeyDown = (e: KeyboardEvent) => {
      // Prevent page scroll in tour mode
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      keys.add(e.key.toLowerCase());
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
    };

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement) {
        state.current.lookYaw -= e.movementX * LOOK_SENSITIVITY_MOUSE;
        state.current.lookPitch = Math.max(
          -PITCH_LIMIT,
          Math.min(PITCH_LIMIT, state.current.lookPitch - e.movementY * LOOK_SENSITIVITY_MOUSE),
        );
      }
    };

    let raf = 0;
    const tick = () => {
      // Keyboard WASD movement
      let fwd = 0;
      let rgt = 0;
      if (keys.has('w') || keys.has('arrowup')) fwd += 1;
      if (keys.has('s') || keys.has('arrowdown')) fwd -= 1;
      if (keys.has('a') || keys.has('arrowleft')) rgt -= 1;
      if (keys.has('d') || keys.has('arrowright')) rgt += 1;

      // Merge with joystick (mobile overrides)
      const mj = moveStick.current;
      if (Math.abs(mj.x) > 0.05 || Math.abs(mj.y) > 0.05) {
        rgt = mj.x;
        fwd = -mj.y; // joystick up = positive y but we want forward
      }

      state.current.forward = fwd;
      state.current.right = rgt;

      // Joystick look
      const lj = lookStick.current;
      if (Math.abs(lj.x) > 0.05 || Math.abs(lj.y) > 0.05) {
        state.current.lookYaw -= lj.x * LOOK_SENSITIVITY_STICK;
        state.current.lookPitch = Math.max(
          -PITCH_LIMIT,
          Math.min(PITCH_LIMIT, state.current.lookPitch - lj.y * LOOK_SENSITIVITY_STICK),
        );
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('mousemove', onMouseMove);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, []);

  const requestLock = (element: HTMLElement) => {
    element.requestPointerLock().catch(() => {
      // pointer lock may be denied on insecure origins or unsupported devices — not fatal
    });
  };

  return { state, joystick, requestLock };
}
