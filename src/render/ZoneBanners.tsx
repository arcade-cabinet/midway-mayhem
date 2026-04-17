/**
 * Zone banners — tall signage on both sides of the track announcing
 * themed stretches. Sampled world-space pose comes from the same
 * track sampler the track geometry uses, so banners sit perfectly
 * flanking the road even on curves.
 *
 * Banner text is baked to a canvas texture at mount — cheap, no
 * runtime font loading.
 */
import { useMemo } from 'react';
import { useQuery } from 'koota/react';
import * as THREE from 'three';
import { trackArchetypes } from '@/config';
import { sampleTrackPose, type SampledSegment } from '@/ecs/systems/trackSampler';
import { TrackSegment, Zone, type ZoneTheme } from '@/ecs/traits';

const THEME_LABEL: Record<ZoneTheme, string> = {
  carnival: 'CARNIVAL',
  funhouse: 'FUNHOUSE',
  ringmaster: 'RINGMASTER',
  grandfinale: 'GRAND FINALE',
};

const THEME_COLOR: Record<ZoneTheme, string> = {
  carnival: '#ff2d87',
  funhouse: '#00e5ff',
  ringmaster: '#ffd600',
  grandfinale: '#ff6f00',
};

function bannerTexture(label: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('banner texture: 2d context unavailable');
  ctx.fillStyle = '#0b0f1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // Accent band top + bottom
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, canvas.width, 12);
  ctx.fillRect(0, canvas.height - 12, canvas.width, 12);
  // Label
  ctx.fillStyle = '#fff1db';
  ctx.font = 'bold 62px "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, canvas.width / 2, canvas.height / 2 + 4);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function ZoneBanners() {
  const trackSegs = useQuery(TrackSegment);
  const zones = useQuery(Zone);

  const sampled: SampledSegment[] = useMemo(() => {
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

  // One texture per theme, reused across sides
  const textures = useMemo(() => {
    const m = new Map<ZoneTheme, THREE.CanvasTexture>();
    for (const t of Object.keys(THEME_LABEL) as ZoneTheme[]) {
      const accent = THEME_COLOR[t];
      m.set(t, bannerTexture(THEME_LABEL[t], accent));
    }
    return m;
  }, []);

  if (sampled.length === 0) return null;
  const halfWidth = (trackArchetypes.laneWidth * trackArchetypes.lanes) / 2;
  const offset = halfWidth + 2.5;

  return (
    <group name="zone-banners">
      {zones.map((e) => {
        const z = e.get(Zone);
        if (!z) return null;
        const p = sampleTrackPose(sampled, z.distance);
        const rightX = Math.cos(p.yaw);
        const rightZ = -Math.sin(p.yaw);
        const tex = textures.get(z.theme) ?? null;
        const accent = THEME_COLOR[z.theme];
        return (
          <group key={e.id()} name={`zone-${z.theme}-${z.distance | 0}`}>
            {([-1, 1] as const).map((side) => {
              const bx = p.x + rightX * side * offset;
              const bz = p.z + rightZ * side * offset;
              return (
                <group
                  key={`s${side}`}
                  position={[bx, p.y, bz]}
                  rotation={[0, p.yaw + (side > 0 ? Math.PI : 0), 0]}
                >
                  {/* Post */}
                  <mesh position={[0, 3, 0]}>
                    <cylinderGeometry args={[0.15, 0.15, 6, 10]} />
                    <meshStandardMaterial color="#9c27b0" roughness={0.6} metalness={0.3} />
                  </mesh>
                  {/* Banner face */}
                  <mesh position={[0, 5, 0.18]}>
                    <planeGeometry args={[4, 1]} />
                    {tex ? (
                      <meshStandardMaterial
                        map={tex}
                        emissive={accent}
                        emissiveIntensity={0.25}
                        side={THREE.DoubleSide}
                      />
                    ) : (
                      <meshStandardMaterial
                        color="#0b0f1a"
                        emissive={accent}
                        emissiveIntensity={0.25}
                        side={THREE.DoubleSide}
                      />
                    )}
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}
