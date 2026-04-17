/**
 * @/track — public barrel for track composition, generation, and rendering.
 */
export { composeTrack, DEFAULT_TRACK } from '@/track/trackComposer';
export type { ComposedTrack, PieceKind, PiecePlacement } from '@/track/trackComposer';
export { laneCenterAt } from '@/track/trackGenerator';
export { TrackSystem } from '@/track/TrackSystem';
export { WorldScroller } from '@/track/WorldScroller';
