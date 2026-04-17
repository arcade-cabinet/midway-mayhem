import { Environment } from '@react-three/drei';
import { assetUrl } from '../assets/manifest';

/**
 * Drei Environment loads the circus_arena HDRI for both lighting
 * and background. No procedural fallback — if the HDR fails to load,
 * the asset preloader already hard-failed before we got here.
 */
export function SkyDome() {
  return <Environment files={assetUrl('hdri:circus_arena')} background={true} blur={0.15} />;
}
