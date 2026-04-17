import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/game/gameState';
import { GovernorDriver } from './GovernorDriver';

/**
 * R3F component that injects Governor steering input when ?governor=1 is set.
 * Must live inside <Canvas> because useFrame is R3F-scoped.
 *
 * IMPORTANT: the governor drives the game by dispatching real ArrowLeft /
 * ArrowRight keyboard events on `window`, NOT by mutating steer directly.
 * This exercises the same `useKeyboardControls` path a human player uses,
 * including wheel rotation, hood banking, and steer ramp/release easing.
 * No shortcuts — if the keyboard pipeline regresses, the governor run
 * visibly fails in screenshot capture.
 *
 * Threshold band: we map the continuous steer scalar the planner computes
 * into one of {left, neutral, right}. Holding the key down while the target
 * remains in that band, releasing on transition, mirrors how a real player
 * taps-and-holds the arrow keys.
 */

type KeyState = 'left' | 'neutral' | 'right';

function steerToKey(steer: number, deadzone = 0.12): KeyState {
  if (steer < -deadzone) return 'left';
  if (steer > deadzone) return 'right';
  return 'neutral';
}

function dispatchKey(code: 'ArrowLeft' | 'ArrowRight', type: 'keydown' | 'keyup'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new KeyboardEvent(type, { key: code, code, bubbles: true, cancelable: true }),
  );
}

export function Governor() {
  const enabled = useRef(false);
  const driverRef = useRef(new GovernorDriver());
  const currentKey = useRef<KeyState>('neutral');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    enabled.current = params.get('governor') === '1';
    if (enabled.current) {
      // biome-ignore lint/suspicious/noExplicitAny: test hook
      (window as any).__mmGovernor = driverRef.current;
    }
  }, []);

  // Release any held key when the component unmounts or governor disables.
  useEffect(() => {
    return () => {
      if (currentKey.current === 'left') dispatchKey('ArrowLeft', 'keyup');
      else if (currentKey.current === 'right') dispatchKey('ArrowRight', 'keyup');
      currentKey.current = 'neutral';
    };
  }, []);

  useFrame((_, dt) => {
    if (!enabled.current) return;
    const s = useGameStore.getState();
    if (!s.running) return;
    // biome-ignore lint/suspicious/noExplicitAny: diag
    const spawner = (window as any).__mmSpawner;
    if (!spawner) return;
    // Player-perception cap: only pass obstacles within a human-legible
    // forward reaction window. At 30 m/s you see roughly 2 s ahead before
    // a hazard becomes unavoidable — 60 m is generous but not omniscient.
    // Never pass obstacles behind the car.
    const PERCEPTION_AHEAD_M = 60;
    const all: Array<{ d: number; x: number; z: number; type: string; radius: number }> =
      spawner.getObstacles();
    const pickupsAll: Array<{ d: number; x: number; z: number; type: string; radius: number }> =
      spawner.getPickups();
    const obstacles = all.filter((o) => {
      const ahead = o.d - s.distance;
      return ahead > 0 && ahead < PERCEPTION_AHEAD_M;
    });
    const pickups = pickupsAll.filter((p) => {
      const ahead = p.d - s.distance;
      return ahead > 0 && ahead < PERCEPTION_AHEAD_M;
    });
    const result = driverRef.current.step(
      { playerD: s.distance, playerLateral: s.lateral, obstacles, pickups },
      dt,
    );
    // Drive the same keyboard pipeline a player uses. Release the previous
    // direction before pressing the new one so up/down events stay paired.
    const next = steerToKey(result.steer);
    const prev = currentKey.current;
    if (next === prev) return;
    if (prev === 'left') dispatchKey('ArrowLeft', 'keyup');
    else if (prev === 'right') dispatchKey('ArrowRight', 'keyup');
    if (next === 'left') dispatchKey('ArrowLeft', 'keydown');
    else if (next === 'right') dispatchKey('ArrowRight', 'keydown');
    currentKey.current = next;
  });

  return null;
}
