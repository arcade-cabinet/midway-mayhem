import { useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from '@/game/gameState';
import { trackToWorld } from '@/obstacles/ObstacleSystem';
import { composeTrack, DEFAULT_TRACK } from '@/track/trackComposer';
import { COLORS, TRACK } from '@/utils/constants';

/**
 * Finish line — a black/white checkered banner stretched across the track
 * between two red-and-white candy-stripe posts, followed by a goal platform
 * that serves as the run-end landing pad. Placed at plan.finishBanner.d, the
 * cumulative track distance where the run ends.
 *
 * Two visual beats:
 *   1. Banner (suspended horizontal rectangle) → "this is THE line"
 *   2. Goal platform (wide deck past the banner) → "keep rolling, you made it"
 *
 * Mounted inside <WorldScroller> so the world transform handles camera
 * alignment; positioning here is done once with trackToWorld at the banner
 * distance.
 */
export function FinishBanner() {
  const finishBanner = useGameStore((s) => s.plan?.finishBanner);
  const composition = useMemo(() => composeTrack(DEFAULT_TRACK, 10), []);

  const bannerPose = useMemo(
    () => (finishBanner ? trackToWorld(composition, finishBanner.d, 0) : null),
    [composition, finishBanner],
  );
  // Goal platform sits past the banner, along the track heading.
  const goalPose = useMemo(
    () =>
      finishBanner && bannerPose
        ? trackToWorld(composition, finishBanner.d + finishBanner.goalPlatformDepthM / 2, 0)
        : null,
    [composition, finishBanner, bannerPose],
  );

  const checkerTex = useMemo(() => makeCheckerTexture(), []);

  if (!finishBanner || !bannerPose || !goalPose) return null;

  const bannerWidth = TRACK.WIDTH + 4;
  const bannerHeight = 2.4;
  const bannerY = 7.5;
  const postRadius = 0.25;
  const postHeight = bannerY + bannerHeight / 2 + 1.0;

  return (
    <group data-testid="finish-banner">
      {/* Banner + posts group (at exact banner distance). */}
      <group position={[bannerPose.x, 0, bannerPose.z]} rotation={[0, bannerPose.heading, 0]}>
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
      <group position={[goalPose.x, 0, goalPose.z]} rotation={[0, goalPose.heading, 0]}>
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
