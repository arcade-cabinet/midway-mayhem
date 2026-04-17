/**
 * Public config entry point. JSON files are imported at build time (Vite
 * supports this via resolveJsonModule), validated with zod, and exported
 * as immutable, typed data. No async loading, no runtime fetch — config
 * ships with the bundle.
 */
import { TrackArchetypeSetSchema, TunablesSchema } from './schema';
import trackPiecesJson from './archetypes/track-pieces.json';
import tunablesJson from './tunables.json';

export const trackArchetypes = TrackArchetypeSetSchema.parse(trackPiecesJson);
export const tunables = TunablesSchema.parse(tunablesJson);

export type { TrackArchetype, TrackArchetypeSet, Tunables } from './schema';
