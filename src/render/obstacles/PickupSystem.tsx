/**
 * PickupSystem — canonical pickup visuals live in TrackContent.tsx (path A).
 *
 * This file is kept as a documented shell so any external imports resolve.
 * TrackContent owns the ECS-driven pickup render (balloon / boost / mega).
 * No GLBs. No /models/ paths.
 *
 * If a future agent needs to move pickup rendering back here:
 *   - Import useSampledTrack + sampleTrackPose (same pattern as TrackContent)
 *   - Query Pickup trait from ECS world
 *   - Remove the pickup block from TrackContent
 */

// Nothing to mount — TrackContent handles all pickup geometry.
export function PickupSystem(): null {
  return null;
}
