import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Vector2 } from 'three';

/**
 * PostFX stack — runs on every device. No perf-tier branches.
 * If this tanks FPS, we fix perf; we don't hide the problem.
 */
export function PostFX() {
  return (
    <EffectComposer multisampling={0}>
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
