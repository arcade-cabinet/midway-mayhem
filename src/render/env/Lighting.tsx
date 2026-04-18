/**
 * Zone-reactive lighting — ambient + directional + zone-accent point light.
 * The accent color and ambient hue change smoothly as the player crosses
 * zone boundaries (the crossfade itself happens at the PostFX layer via
 * BrightnessContrast/HueSaturation; here we just switch the light color).
 */
import { useGameStore } from '@/game/gameState';
import { themeFor } from '@/track/zoneSystem';

export function Lighting() {
  const zone = useGameStore((s) => s.currentZone);
  const theme = themeFor(zone);
  return (
    <>
      <ambientLight intensity={0.55} color={theme.ambientHue} />
      <directionalLight position={[10, 20, 5]} intensity={0.8} color="#ffffff" />
      <pointLight position={[0, 8, 4]} intensity={0.6} color={theme.accent} distance={30} />
    </>
  );
}
