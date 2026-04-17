import { useEffect, useState } from 'react';
import { breakpoints } from '../design/tokens';

export type FormFactorTier =
  | 'phone-portrait'
  | 'phone-landscape'
  | 'tablet-portrait'
  | 'tablet-landscape'
  | 'desktop'
  | 'ultrawide';

export interface FormFactor {
  tier: FormFactorTier;
  aspect: number;
  width: number;
  height: number;
  isPortrait: boolean;
  isMobile: boolean;
}

export function useFormFactor(): FormFactor {
  const [ff, setFf] = useState<FormFactor>(() => compute());
  useEffect(() => {
    const update = () => setFf(compute());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return ff;
}

function compute(): FormFactor {
  if (typeof window === 'undefined') {
    return {
      tier: 'desktop',
      aspect: 1.78,
      width: 1280,
      height: 720,
      isPortrait: false,
      isMobile: false,
    };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspect = width / height;
  const isPortrait = aspect < breakpoints.aspect.landscapeThreshold;
  const isMobile = Math.min(width, height) <= breakpoints.viewport.md;

  let tier: FormFactorTier;
  if (aspect >= breakpoints.aspect.ultrawide) tier = 'ultrawide';
  else if (aspect >= breakpoints.aspect.wide) tier = 'desktop';
  else if (isPortrait) {
    if (aspect <= breakpoints.aspect.phonePortrait) tier = 'phone-portrait';
    else tier = 'tablet-portrait';
  } else {
    if (width <= breakpoints.viewport.md) tier = 'phone-landscape';
    else if (width <= breakpoints.viewport.lg) tier = 'tablet-landscape';
    else tier = 'desktop';
  }
  return { tier, aspect, width, height, isPortrait, isMobile };
}
