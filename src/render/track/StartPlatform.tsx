/**
 * Suspended "launching pad" at track distance 0 — the anchor the player
 * physically starts on. Wire cables reach UP into the big-top rafters, so the
 * deck reads as hung from the circus rigging rather than floating. A wooden
 * plank surface with polka-dot trim rails matches the carnival brand.
 *
 * Placement: the plan supplies widthM × depthM. We place the pad centered on
 * the track centerline at d=0, rotated to align with the initial track
 * heading. Static — composed once at mount from the DEFAULT_TRACK composition.
 *
 * Height: the platform group sits at PLATFORM_Y (+30m world-space) above the
 * scene origin so the player's POV looks DOWN at the coil from near the rafters.
 * Four chrome wire struts extend upward from the deck to the dome cap at
 * approximately +50m world-space (DOME_CAP_Y). This makes the suspension
 * structurally obvious: the platform is clearly HANGING, not floating.
 *
 * The track generator is not touched — piece 0 remains at y=0.5m (integrator
 * ground clearance). All height comes from this component's scene-graph y.
 *
 * Mounted inside <WorldScroller>, so the pad drifts away behind the player as
 * the run progresses (exactly like every other track-anchored prop).
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { sampleTrackPose } from '@/ecs/systems/trackSampler';
import { useSampledTrack } from '@/ecs/systems/useSampledTrack';
import { useGameStore } from '@/game/gameState';
import { COLORS } from '@/utils/constants';

/**
 * How high the platform group sits in world space (metres above scene origin).
 * The track generator starts piece 0 at y=0.5; this constant keeps the
 * platform 30m above scene origin (≈ 29.5m above the track surface).
 * The player's cockpit camera starts at the platform's height and looks DOWN
 * at the coil unwinding below.
 */
export const PLATFORM_Y = 30;

/**
 * Approximate world-space y of the dome cap (circus big-top crown). Wire
 * struts extend from the platform deck upward to this level. In local
 * group space that is DOME_CAP_Y - PLATFORM_Y above the group origin.
 */
export const DOME_CAP_Y = 50;

/**
 * Inset distance (metres) from each platform edge for the wire strut attachment
 * points. Exported so structural tests can verify the 4-corner layout.
 */
export const STRUT_CORNER_INSET = 0.4 as const;

/** Number of wire struts. Always 4 — one per platform corner. */
export const WIRE_STRUT_COUNT = 4 as const;

export function StartPlatform() {
  const startPlatform = useGameStore((s) => s.plan?.startPlatform);
  const sampled = useSampledTrack();
  const signTexture = useMemo(() => makeStartSignTexture(), []);

  const pose = useMemo(() => (sampled.length > 0 ? sampleTrackPose(sampled, 0) : null), [sampled]);

  if (!startPlatform || !pose) return null;

  const { widthM, depthM } = startPlatform;
  // Deck sits a hair BELOW the road surface so the player's car rolls off
  // smoothly; the track itself is ~0 elevation at d=0.
  // deckY is expressed in the group's LOCAL space (group itself is at PLATFORM_Y).
  const deckY = pose.y - 0.1;

  // Wire struts: from deck level up to the dome cap.
  // In local group coordinates: bottom at deckY, top at (DOME_CAP_Y - PLATFORM_Y).
  const strutBottom = deckY;
  const strutTop = DOME_CAP_Y - PLATFORM_Y; // = +20m in local group space
  const strutLength = strutTop - strutBottom;
  const strutMidY = strutBottom + strutLength / 2;
  const strutRadius = 0.06;

  return (
    <group
      data-testid="start-platform"
      position={[pose.x, PLATFORM_Y, pose.z]}
      rotation={[0, pose.yaw, 0]}
    >
      {/* Wire struts — 4 corners rising from deck to the dome cap (~+50m world) */}
      {(
        [
          [-widthM / 2 + STRUT_CORNER_INSET, -depthM / 2 + STRUT_CORNER_INSET],
          [widthM / 2 - STRUT_CORNER_INSET, -depthM / 2 + STRUT_CORNER_INSET],
          [-widthM / 2 + STRUT_CORNER_INSET, depthM / 2 - STRUT_CORNER_INSET],
          [widthM / 2 - STRUT_CORNER_INSET, depthM / 2 - STRUT_CORNER_INSET],
        ] as const
      ).map(([sx, sz], i) => (
        <mesh
          // biome-ignore lint/suspicious/noArrayIndexKey: stable 4-corner layout
          key={i}
          data-testid="wire-strut"
          position={[sx, strutMidY, sz]}
        >
          <cylinderGeometry args={[strutRadius, strutRadius, strutLength, 8]} />
          <meshStandardMaterial color="#8a8a92" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}

      {/* Wooden plank deck */}
      <mesh position={[0, deckY, 0]}>
        <boxGeometry args={[widthM, 0.35, depthM]} />
        <meshStandardMaterial color="#9a6a3a" roughness={0.95} metalness={0.02} />
      </mesh>

      {/* Polka-dot trim rails — alternating yellow/red blocks along the front
          and back edges. Purely decorative lateral curb pieces. */}
      {buildTrim({ widthM, depthM, y: deckY + 0.22 })}

      {/* START sign plane. Previously placed at z = -depthM/2 + 0.2 which
          put it ~3.8m in FRONT of the driver's face on spawn (platform
          center at player position, sign at back edge of platform → after
          the track's forward rotation this becomes +forward of camera).
          Moved to z = +depthM/2 - 0.2 so the sign is at the BACK of the
          platform relative to the driver — i.e. behind the car as the
          player drives forward off the platform. Still read-on at the
          moment the car crosses the starting line heading toward the sign.
          Faces -Z (toward the driver approaching from +Z) via rotation 0. */}
      <mesh position={[0, deckY + 2.2, depthM / 2 - 0.2]}>
        <planeGeometry args={[widthM * 0.55, 1.6]} />
        <meshBasicMaterial map={signTexture} transparent toneMapped={false} />
      </mesh>
      {/* Sign back (blank polka-dot) so the rear isn't an invisible quad */}
      <mesh position={[0, deckY + 2.2, depthM / 2 - 0.2 + 0.01]}>
        <planeGeometry args={[widthM * 0.55, 1.6]} />
        <meshStandardMaterial color={COLORS.RED} roughness={0.7} />
      </mesh>
      {/* Sign posts — moved to back of platform to flank the relocated sign. */}
      <mesh position={[-widthM * 0.22, deckY + 1.2, depthM / 2 - 0.2]}>
        <cylinderGeometry args={[0.06, 0.06, 2.2, 8]} />
        <meshStandardMaterial color={COLORS.YELLOW} metalness={0.25} roughness={0.4} />
      </mesh>
      <mesh position={[widthM * 0.22, deckY + 1.2, depthM / 2 - 0.2]}>
        <cylinderGeometry args={[0.06, 0.06, 2.2, 8]} />
        <meshStandardMaterial color={COLORS.YELLOW} metalness={0.25} roughness={0.4} />
      </mesh>
    </group>
  );
}

/**
 * Polka-dot trim rails along both length-edges of the deck. Yellow/red
 * alternating capsule blocks — brand-consistent with the cockpit livery.
 */
function buildTrim({ widthM, depthM, y }: { widthM: number; depthM: number; y: number }) {
  const blocks: Array<{ x: number; z: number; color: string; key: string }> = [];
  const blockLen = 0.6;
  const edges: Array<{ sign: 1 | -1; axis: 'x' | 'z'; span: number }> = [
    { sign: 1, axis: 'x', span: depthM },
    { sign: -1, axis: 'x', span: depthM },
    { sign: 1, axis: 'z', span: widthM },
    { sign: -1, axis: 'z', span: widthM },
  ];
  for (const e of edges) {
    const count = Math.max(2, Math.floor(e.span / blockLen));
    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const along = (t - 0.5) * e.span;
      const x = e.axis === 'x' ? (e.sign * widthM) / 2 : along;
      const z = e.axis === 'z' ? (e.sign * depthM) / 2 : along;
      const color = i % 2 === 0 ? COLORS.YELLOW : COLORS.RED;
      blocks.push({ x, z, color, key: `${e.axis}${e.sign}-${i}` });
    }
  }
  return (
    <group name="start-trim">
      {blocks.map((b) => (
        <mesh key={b.key} position={[b.x, y, b.z]}>
          <boxGeometry args={[blockLen * 0.9, 0.18, blockLen * 0.9]} />
          <meshStandardMaterial color={b.color} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Canvas-baked "START" sign. Bangers-style oversized circus lettering on a
 * yellow circus-ticket field with red border. Canvas beats troika-text here
 * because we don't need text to be dynamic, and baking to a texture keeps the
 * start pad render to a single draw per mesh.
 */
function makeStartSignTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 384;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('StartSign: no 2d ctx');

  // Ticket-yellow background
  ctx.fillStyle = COLORS.YELLOW;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Red border
  ctx.strokeStyle = COLORS.RED;
  ctx.lineWidth = 32;
  ctx.strokeRect(16, 16, canvas.width - 32, canvas.height - 32);

  // Text
  ctx.fillStyle = COLORS.RED;
  ctx.font = 'bold 260px "Bangers", "Impact", "Haettenschweiler", "Arial Narrow Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('START', canvas.width / 2, canvas.height / 2 + 12);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
