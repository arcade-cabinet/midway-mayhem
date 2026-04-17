import {
  Bloom,
  BrightnessContrast,
  ChromaticAberration,
  EffectComposer,
  HueSaturation,
  Noise,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector2 } from 'three';
import type { ZoneId } from '../utils/constants';
import { useGameStore } from '../systems/gameState';

/** Per-zone color grade target values. */
const ZONE_GRADES: Record<ZoneId, { hue: number; saturation: number; brightness: number; contrast: number }> = {
  'midway-strip':    { hue: 0,     saturation: 0,    brightness: 0,    contrast: 0    },
  'balloon-alley':  { hue: 0.08,  saturation: 0.15, brightness: 0.03, contrast: 0    },
  'ring-of-fire':   { hue: -0.05, saturation: 0.25, brightness: -0.02, contrast: 0   },
  'funhouse-frenzy':{ hue: 0.2,   saturation: 0.35, brightness: 0,    contrast: 0.1  },
};

/** Time constant for crossfade: ~2 s to reach 63% of target. */
const GRADE_TAU = 2.0;

/**
 * PostFX stack — runs on every device. No perf-tier branches.
 * If this tanks FPS, we fix perf; we don't hide the problem.
 */
export function PostFX() {
  const grade = useRef({ hue: 0, saturation: 0, brightness: 0, contrast: 0 });

  useFrame((_state, dt) => {
    const zone = useGameStore.getState().currentZone;
    const target = ZONE_GRADES[zone];
    const k = 1 - Math.exp(-dt / GRADE_TAU);
    const g = grade.current;
    g.hue        += (target.hue        - g.hue)        * k;
    g.saturation += (target.saturation - g.saturation) * k;
    g.brightness += (target.brightness - g.brightness) * k;
    g.contrast   += (target.contrast   - g.contrast)   * k;
  });

  return (
    <EffectComposer multisampling={0}>
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <HueSaturation
        hue={grade.current.hue}
        saturation={grade.current.saturation}
        blendFunction={BlendFunction.NORMAL}
      />
      <BrightnessContrast
        brightness={grade.current.brightness}
        contrast={grade.current.contrast}
        blendFunction={BlendFunction.NORMAL}
      />
      <Bloom intensity={0.45} luminanceThreshold={0.72} luminanceSmoothing={0.22} mipmapBlur />
      <ChromaticAberration
        offset={new Vector2(0.0009, 0.0009)}
        radialModulation={false}
        modulationOffset={0}
        blendFunction={BlendFunction.NORMAL}
      />
      <Noise premultiply opacity={0.025} blendFunction={BlendFunction.MULTIPLY} />
      <Vignette eskil={false} offset={0.28} darkness={0.55} />
    </EffectComposer>
  );
}
