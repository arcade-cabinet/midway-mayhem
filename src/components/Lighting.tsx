import { useGameStore } from '../systems/gameState';
import { themeFor } from '../systems/zoneSystem';

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
