/**
 * @/track — public barrel for track composition, generation, and rendering.
 */

export { FinishBanner } from '@/track/FinishBanner';
export { StartPlatform } from '@/track/StartPlatform';
export { TrackSystem } from '@/track/TrackSystem';
export type { ComposedTrack, PieceKind, PiecePlacement } from '@/track/trackComposer';
export { composeTrack, DEFAULT_TRACK } from '@/track/trackComposer';
export { laneCenterAt } from '@/track/trackGenerator';
export { WorldScroller } from '@/track/WorldScroller';
