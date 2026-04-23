/**
 * Finish line (PRQ A-DESC-3) — a black/white checkered banner stretched
 * across the track, plus a WIDE B&W race-finish floor quad that spans the
 * dome floor at the banner distance. The floor quad is how the player
 * reads "I landed at the bottom of the dome" — it's the geometric anchor
 * of the descent.
 *
 * Visual beats:
 *   1. Floor checker (~60m square centered on the banner, y clamped near
 *      0) → "I'm on the circus floor"
 *   2. Banner (suspended horizontal rectangle) → "this is THE line"
 *   3. Goal platform (wide deck past the banner) → "keep rolling, you made it"
 *
 * Mounted inside <WorldScroller> so the world transform handles camera
 * alignment; positioning here is done once with trackToWorld at the banner
 * distance.
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { sampleTrackPose } from '@/ecs/systems/trackSampler';
import { useSampledTrack } from '@/ecs/systems/useSampledTrack';
import { useGameStore } from '@/game/gameState';
import { COLORS, TRACK } from '@/utils/constants';

/** Dome floor altitude — the lowest visible surface inside the big-top,
 *  a touch below world-origin so the track surface still reads above it. */
const DOME_FLOOR_Y = -0.1;
/** Side length in meters of the square B&W checker race-line floor. */
const FINISH_FLOOR_SIZE_M = 60;
/** Columns of the floor checker; squares are sized to read as a finish
 *  grid (~30 cells wide at 60m → 2m per square). */
const FINISH_FLOOR_CHECKER_COLS = 30;

export function FinishBanner() {
  const finishBanner = useGameStore((s) => s.plan?.finishBanner);
  const sampled = useSampledTrack();
  const checkerTex = useMemo(() => makeCheckerTexture(), []);
  const floorCheckerTex = useMemo(
    () => makeFinishFloorTexture(FINISH_FLOOR_CHECKER_COLS),
    [],
  );

  // Total length of the ECS-sampled track. If the run plan's finish distance
  // is beyond this, sampleTrackPose would clamp the banner to the last-
  // segment pose — which lands it right on top of the player's world-space
  // camera position (see issue #119). Defer rendering the banner until the
  // player is within the sampled track extent of the finish line.
  const sampledTotal = useMemo(() => {
    if (sampled.length === 0) return 0;
    const last = sampled[sampled.length - 1];
    return last ? last.distanceStart + last.length : 0;
  }, [sampled]);

  const bannerPose = useMemo(
    () =>
      finishBanner && sampled.length > 0 && finishBanner.d <= sampledTotal
        ? sampleTrackPose(sampled, finishBanner.d)
        : null,
    [sampled, sampledTotal, finishBanner],
  );
  const goalPose = useMemo(
    () =>
      finishBanner && sampled.length > 0 && finishBanner.d <= sampledTotal
        ? sampleTrackPose(sampled, finishBanner.d + finishBanner.goalPlatformDepthM / 2)
        : null,
    [sampled, sampledTotal, finishBanner],
  );

  if (!finishBanner || !bannerPose || !goalPose) return null;

  const bannerWidth = TRACK.WIDTH + 4;
  const bannerHeight = 2.4;
  const bannerY = 7.5;
  const postRadius = 0.25;
  const postHeight = bannerY + bannerHeight / 2 + 1.0;

  // Floor checker: a wide square at the banner position but clamped to
  // dome-floor altitude. Anchors the run end at y ≈ 0 regardless of where
  // the track generator happens to land — the player reads "I'm on the
  // circus floor" even if the integrator drifted slightly high.
  const floorCheckerSize = FINISH_FLOOR_SIZE_M;
  // Floor altitude is the dome floor, NOT sampled track y (which descends
  // from track piece 0 altitude). The descent coil lives ABOVE this floor;
  // the floor itself is the bottom of the big-top.
  const floorY = DOME_FLOOR_Y;

  return (
    <group data-testid="finish-banner">
      {/* Floor checker — a wide square at the banner position but y clamped
          to the dome floor. This is the geometric anchor that reads
          "circus floor, race finish". Parent-rotated with the banner so the
          grid aligns with the run's approach axis. */}
      <group
        position={[bannerPose.x, floorY, bannerPose.z]}
        rotation={[0, bannerPose.yaw, 0]}
        data-testid="finish-floor"
      >
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[floorCheckerSize, floorCheckerSize]} />
          <meshStandardMaterial
            map={floorCheckerTex}
            side={THREE.DoubleSide}
            roughness={0.6}
            metalness={0.05}
          />
        </mesh>
      </group>

      {/* Banner + posts group (at exact banner distance). */}
      <group position={[bannerPose.x, 0, bannerPose.z]} rotation={[0, bannerPose.yaw, 0]}>
        {/* Left post */}
        <mesh position={[-bannerWidth / 2, postHeight / 2, 0]}>
          <cylinderGeometry args={[postRadius, postRadius, postHeight, 14]} />
          <meshStandardMaterial color={COLORS.RED} roughness={0.5} />
        </mesh>
        {/* Left post stripe — a thinner overlaid cylinder of alternating white bands */}
        <mesh position={[-bannerWidth / 2, postHeight / 2, 0]}>
          <cylinderGeometry args={[postRadius * 1.02, postRadius * 1.02, postHeight, 14]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.45} />
        </mesh>
        {/* Right post */}
        <mesh position={[bannerWidth / 2, postHeight / 2, 0]}>
          <cylinderGeometry args={[postRadius, postRadius, postHeight, 14]} />
          <meshStandardMaterial color={COLORS.RED} roughness={0.5} />
        </mesh>
        <mesh position={[bannerWidth / 2, postHeight / 2, 0]}>
          <cylinderGeometry args={[postRadius * 1.02, postRadius * 1.02, postHeight, 14]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.45} />
        </mesh>

        {/* CHECKERED BANNER — a thin flat box spanning the track, facing the
            oncoming driver. We render BOTH sides with the checker texture
            (double-sided material) so the banner reads correctly regardless
            of approach angle. */}
        <mesh position={[0, bannerY, 0]}>
          <planeGeometry args={[bannerWidth, bannerHeight]} />
          <meshStandardMaterial
            map={checkerTex}
            side={THREE.DoubleSide}
            roughness={0.55}
            metalness={0.0}
          />
        </mesh>

        {/* Top valance — a thin red trim strip capping the banner */}
        <mesh position={[0, bannerY + bannerHeight / 2 + 0.1, 0]}>
          <boxGeometry args={[bannerWidth, 0.2, 0.1]} />
          <meshStandardMaterial color={COLORS.RED} roughness={0.5} />
        </mesh>
        {/* Bottom valance */}
        <mesh position={[0, bannerY - bannerHeight / 2 - 0.1, 0]}>
          <boxGeometry args={[bannerWidth, 0.2, 0.1]} />
          <meshStandardMaterial color={COLORS.RED} roughness={0.5} />
        </mesh>

        {/* Celebratory spotlight pair — angled down onto the approach */}
        <spotLight
          position={[-bannerWidth / 2, bannerY + 2, 0]}
          target-position={[0, 0, -8]}
          angle={Math.PI / 5}
          penumbra={0.5}
          intensity={2.0}
          distance={40}
          color="#fff5c0"
        />
        <spotLight
          position={[bannerWidth / 2, bannerY + 2, 0]}
          target-position={[0, 0, -8]}
          angle={Math.PI / 5}
          penumbra={0.5}
          intensity={2.0}
          distance={40}
          color="#fff5c0"
        />
      </group>

      {/* GOAL PLATFORM — a wider deck past the banner that catches the player.
          Rendered as a separate group at the goal-midpoint distance so it
          aligns with the post-banner track heading (which can differ on a
          curved segment). */}
      <group position={[goalPose.x, 0, goalPose.z]} rotation={[0, goalPose.yaw, 0]}>
        <mesh position={[0, goalPose.y - 0.05, 0]}>
          <boxGeometry args={[TRACK.WIDTH + 6, 0.4, finishBanner.goalPlatformDepthM]} />
          <meshStandardMaterial color={COLORS.PURPLE} roughness={0.7} />
        </mesh>
        {/* Gold trim along the long sides */}
        <mesh position={[(TRACK.WIDTH + 6) / 2 - 0.15, goalPose.y + 0.2, 0]}>
          <boxGeometry args={[0.3, 0.35, finishBanner.goalPlatformDepthM]} />
          <meshStandardMaterial color={COLORS.YELLOW} metalness={0.4} roughness={0.3} />
        </mesh>
        <mesh position={[-((TRACK.WIDTH + 6) / 2 - 0.15), goalPose.y + 0.2, 0]}>
          <boxGeometry args={[0.3, 0.35, finishBanner.goalPlatformDepthM]} />
          <meshStandardMaterial color={COLORS.YELLOW} metalness={0.4} roughness={0.3} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Classic 8×2 black/white racing-flag checker pattern, procedurally rendered
 * to a CanvasTexture. Kept as a runtime helper rather than a static asset
 * because the banner dimensions and square density are authored here.
 */
function makeCheckerTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('FinishBanner: no 2d ctx');
  const cols = 16;
  const rows = 4;
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#0a0a0a';
      ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Floor-scale B&W racing checker. Same black-and-white pattern as the
 * banner, but square (N×N) instead of wide, sized for the dome floor quad.
 * Higher resolution (2048) since the player can be close to it at the
 * finish.
 */
function makeFinishFloorTexture(cols: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('FinishBanner: no 2d ctx for floor');
  const cellW = canvas.width / cols;
  const cellH = canvas.height / cols;
  for (let r = 0; r < cols; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#0a0a0a';
      ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
