/**
 * Spawn zone banners every ~500m along the generated track. Themes cycle
 * in order so every run has an identical rhythm even if the geometry
 * itself is seeded differently — gives long runs a sense of chapter
 * structure without needing world state for each zone.
 */
import type { World } from 'koota';
import { Zone, type ZoneTheme } from '@/ecs/traits';

const CYCLE: ZoneTheme[] = ['carnival', 'funhouse', 'ringmaster', 'grandfinale'];

export function seedZones(world: World, trackLengthM = 1600, intervalM = 500): void {
  const lead = 120; // first zone a bit past the start so it's visible but not in your face
  for (let d = lead, i = 0; d < trackLengthM; d += intervalM, i++) {
    const theme = CYCLE[i % CYCLE.length];
    if (!theme) continue;
    world.spawn(Zone({ theme, distance: d }));
  }
}
