/**
 * Per-frame glue: advance the player's ECS state via useFrame.
 *
 * R3F's useFrame invokes this every tick with delta time. We hand off to
 * the pure `stepPlayer` function so the motion logic stays testable in
 * isolation from the renderer.
 */
import { useFrame } from '@react-three/fiber';
import type { World } from 'koota';
import { stepPlayer } from './playerMotion';

export function usePlayerLoop(world: World, enabled: boolean): void {
  useFrame((_state, dt) => {
    if (!enabled) return;
    // Clamp pathological dts (tab-switch spikes): cap at 100ms so a long
    // pause doesn't teleport the player kilometers forward.
    const clamped = Math.min(dt, 0.1);
    stepPlayer(world, clamped);
  });
}
