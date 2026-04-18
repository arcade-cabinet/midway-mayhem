import { useEffect, useState } from 'react';

/**
 * Returns a vertical FOV that keeps horizontal FOV ≈ targetHFov degrees.
 * On portrait phones, this widens vertical FOV so cockpit + track fit.
 * Clamped [50, 110] to avoid fisheye.
 */
export function useResponsiveFov(targetHFovDeg = 92): number {
  const [vFov, setVFov] = useState(() => compute(targetHFovDeg));

  useEffect(() => {
    const onResize = () => setVFov(compute(targetHFovDeg));
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, [targetHFovDeg]);

  return vFov;
}

function compute(targetHFovDeg: number): number {
  if (typeof window === 'undefined') return 70;
  const aspect = Math.max(window.innerWidth / window.innerHeight, 0.001);
  const hFovRad = (targetHFovDeg * Math.PI) / 180;
  const vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) / aspect);
  const vFovDeg = (vFovRad * 180) / Math.PI;
  return Math.max(50, Math.min(110, vFovDeg));
}
