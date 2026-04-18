/**
 * SkyDome — drei Environment loads the circus_arena HDRI for both IBL
 * lighting and the visible background. No procedural fallback — if the HDR
 * fails to load, the asset preloader hard-fails before we get here.
 *
 * The blur softens the HDRI slightly at the periphery so it reads more as
 * "far-away circus tent" and less as a sharp photograph.
 */
import { Environment } from '@react-three/drei';

/** HDRI path relative to public root. Matches public/hdri/circus_arena_2k.hdr. */
const HDRI_PATH = `${import.meta.env.BASE_URL}hdri/circus_arena_2k.hdr`;

export function SkyDome() {
  return <Environment files={HDRI_PATH} background={true} blur={0.15} />;
}
