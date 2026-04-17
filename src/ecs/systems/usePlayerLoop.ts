/**
 * Per-frame glue: advance the player's ECS state via useFrame.
 *
 * R3F's useFrame invokes this every tick with delta time. We hand off to
 * the pure `stepPlayer` function so the motion logic stays testable in
 * isolation from the renderer.
 */
import { useFrame } from '@react-three/fiber';
import type { World } from 'koota';
import { stepCollisions } from './collisions';
import { stepPlayer } from './playerMotion';

interface LoopHooks {
  onObstacle?: (kind: 'cone' | 'oil') => void;
  onPickup?: (kind: 'balloon' | 'boost') => void;
}

export function usePlayerLoop(world: World, enabled: boolean, hooks: LoopHooks = {}): void {
  useFrame((_state, dt) => {
    if (!enabled) return;
    const clamped = Math.min(dt, 0.1);
    stepPlayer(world, clamped);
    stepCollisions(world, clamped, hooks);
  });
}
