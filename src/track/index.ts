/**
 * @/track — public barrel for track composition, generation, and rendering.
 */
export { composeTrack, DEFAULT_TRACK } from '../game/trackComposer';
export type { ComposedTrack, PieceKind, PiecePlacement } from '../game/trackComposer';
export { laneCenterAt } from '../systems/trackGenerator';
export { TrackSystem } from '../components/TrackSystem';
export { WorldScroller } from '../components/WorldScroller';
