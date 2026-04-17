/**
 * Post-processing: bloom + vignette for arcade gloss. Static settings —
 * earlier attempt to make chromatic aberration speed-responsive caused
 * serialization crashes inside r3f. Simple is better than broken.
 */
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';

export function PostFX() {
  return (
    <EffectComposer multisampling={0}>
      <Bloom intensity={0.55} luminanceThreshold={0.55} luminanceSmoothing={0.4} mipmapBlur />
      <Vignette eskil={false} offset={0.25} darkness={0.45} />
    </EffectComposer>
  );
}
