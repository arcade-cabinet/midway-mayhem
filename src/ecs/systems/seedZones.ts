/**
 * Spawn zone banners every ~500m along the generated track. Themes cycle
 * in order so every run has an identical rhythm even if the geometry
 * itself is seeded differently — gives long runs a sense of chapter
 * structure without needing world state for each zone.
 *
 * Track length is derived from the currently-spawned TrackSegment entities
 * rather than hardcoded. Previous version used trackLengthM=1600 default
 * and got out of sync with real track lengths — flagged in PR #18 review.
 */
import type { World } from 'koota';
import { TrackSegment, Zone, type ZoneTheme } from '@/ecs/traits';

const CYCLE: ZoneTheme[] = ['carnival', 'funhouse', 'ringmaster', 'grandfinale'];

/** Lead-in before the first zone so it's visible past the starting line but
 *  not literally in the player's face. */
const LEAD_IN = 120;
const DEFAULT_INTERVAL = 500;

/** Sum every TrackSegment's length to get the real track meter-length.
 *  Call AFTER seedTrack; returns 0 if no segments have spawned. */
function computeTrackLength(world: World): number {
  let total = 0;
  world.query(TrackSegment).updateEach(([seg]) => {
    total += seg.length;
  });
  return total;
}

export function seedZones(
  world: World,
  {
    intervalM = DEFAULT_INTERVAL,
    trackLengthM,
  }: { intervalM?: number; trackLengthM?: number } = {},
): void {
  const length = trackLengthM ?? computeTrackLength(world);
  if (length <= LEAD_IN) return;
  for (let d = LEAD_IN, i = 0; d < length; d += intervalM, i++) {
    const theme = CYCLE[i % CYCLE.length];
    if (!theme) continue;
    world.spawn(Zone({ theme, distance: d }));
  }
}
