/**
 * Public config entry point. JSON files are imported at build time (Vite
 * supports this via resolveJsonModule), validated with zod, and exported
 * as immutable, typed data. No async loading, no runtime fetch — config
 * ships with the bundle.
 */

import trackPiecesJson from './archetypes/track-pieces.json';
import cockpitBlueprintJson from './cockpit-blueprint.json';
import { CockpitBlueprintSchema, TrackArchetypeSetSchema, TunablesSchema } from './schema';
import tunablesJson from './tunables.json';

export const trackArchetypes = TrackArchetypeSetSchema.parse(trackPiecesJson);
export const tunables = TunablesSchema.parse(tunablesJson);
export const cockpitBlueprint = CockpitBlueprintSchema.parse(cockpitBlueprintJson);

export type {
  CockpitBlueprint,
  CockpitMaterial,
  CockpitMesh,
  TrackArchetype,
  TrackArchetypeSet,
  Tunables,
} from './schema';
