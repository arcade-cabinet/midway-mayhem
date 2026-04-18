/**
 * Shared helper for render components that need to position props along
 * the live procedural track via distance-along-centerline → world-space
 * sampling. Mirrors the pattern used by TrackContent.tsx /
 * StartPlatform.tsx / FinishBanner.tsx, so components don't each
 * re-implement the TrackSegment→SampledSegment mapping.
 *
 * Usage:
 *   const sampled = useSampledTrack();
 *   const pose = useMemo(
 *     () => (sampled.length > 0 ? sampleTrackPose(sampled, d) : null),
 *     [sampled, d],
 *   );
 *
 * Returned array is stable across renders until any TrackSegment entity
 * changes, so downstream useMemos keyed on `[sampled, d]` are cheap.
 */
import { useQuery } from 'koota/react';
import { useMemo } from 'react';
import type { SampledSegment } from '@/ecs/systems/trackSampler';
import { TrackSegment } from '@/ecs/traits';

export function useSampledTrack(): SampledSegment[] {
  const trackSegs = useQuery(TrackSegment);
  return useMemo(() => {
    const traits = trackSegs
      .map((e) => e.get(TrackSegment))
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.index - b.index);
    return traits.map((seg) => ({
      startPose: {
        x: seg.startX,
        y: seg.startY,
        z: seg.startZ,
        yaw: seg.startYaw,
        pitch: seg.startPitch,
      },
      archetypeId: seg.archetype,
      length: seg.length,
      deltaYaw: seg.deltaYaw,
      deltaPitch: seg.deltaPitch,
      bank: seg.bank,
      distanceStart: seg.distanceStart,
    }));
  }, [trackSegs]);
}
