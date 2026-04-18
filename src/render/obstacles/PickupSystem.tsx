/**
 * PickupSystem — null shell (Path A).
 *
 * All pickup visuals are rendered by TrackContent.tsx (Path A — canonical
 * ECS path). This component is intentionally empty; it exists only so
 * any import of PickupSystem in the codebase compiles without modification.
 *
 * If a specialized pickup visual layer is needed in the future, add it here
 * alongside TrackContent rather than replacing it.
 */

export function PickupSystem(): null {
  return null;
}
