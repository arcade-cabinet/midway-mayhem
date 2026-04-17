/**
 * Form-factor hook: reports viewport classification + responsive cockpit
 * transform so every surface (cockpit scale, hood offset, HUD size) can
 * react the same way without each doing its own matchMedia dance.
 *
 * Re-reads on resize and orientationchange. Phone portrait gets the tightest
 * cockpit scale so the small amount of remaining screen real estate goes to
 * the track, not the dashboard. Desktop runs at full scale.
 */
import { useEffect, useState } from 'react';

export type FormTier =
  | 'phone-portrait'
  | 'phone-landscape'
  | 'tablet-portrait'
  | 'tablet-landscape'
  | 'desktop'
  | 'ultrawide';

export interface FormFactor {
  tier: FormTier;
  aspect: number;
  width: number;
  height: number;
  isPortrait: boolean;
  isMobile: boolean;
}

function classify(width: number, height: number): FormTier {
  const aspect = width / height;
  const portrait = height > width;
  if (aspect >= 2.2) return 'ultrawide';
  if (width >= 1200) return 'desktop';
  if (width >= 768) return portrait ? 'tablet-portrait' : 'tablet-landscape';
  return portrait ? 'phone-portrait' : 'phone-landscape';
}

function snapshot(): FormFactor {
  const w = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const h = typeof window === 'undefined' ? 720 : window.innerHeight;
  return {
    tier: classify(w, h),
    aspect: w / h,
    width: w,
    height: h,
    isPortrait: h > w,
    isMobile: w < 768,
  };
}

export function useFormFactor(): FormFactor {
  const [ff, setFf] = useState<FormFactor>(() => snapshot());
  useEffect(() => {
    const update = () => setFf(snapshot());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return ff;
}

export interface CockpitTransform {
  scale: number;
  hoodZOffset: number;
}

export function responsiveCockpitTransform(tier: FormTier): CockpitTransform {
  switch (tier) {
    case 'phone-portrait':
      return { scale: 0.8, hoodZOffset: -0.4 };
    case 'phone-landscape':
      return { scale: 0.92, hoodZOffset: -0.1 };
    case 'tablet-portrait':
      return { scale: 0.9, hoodZOffset: -0.2 };
    case 'tablet-landscape':
      return { scale: 0.96, hoodZOffset: 0 };
    case 'ultrawide':
      return { scale: 1.0, hoodZOffset: 0 };
    case 'desktop':
    default:
      return { scale: 1.0, hoodZOffset: 0 };
  }
}
