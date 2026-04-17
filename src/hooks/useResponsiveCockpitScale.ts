import { useFormFactor } from './useFormFactor';

/**
 * Responsive cockpit scale + hood offset. On portrait phones we scale down
 * the whole cockpit body and push the hood slightly further forward so the
 * player sees more of the track. Desktop stays full-size.
 */
export function useResponsiveCockpitScale(): {
  scale: number;
  hoodZOffset: number;
} {
  const ff = useFormFactor();
  switch (ff.tier) {
    case 'phone-portrait':
      return { scale: 0.8, hoodZOffset: -0.4 };
    case 'tablet-portrait':
      return { scale: 0.9, hoodZOffset: -0.2 };
    case 'phone-landscape':
      return { scale: 0.92, hoodZOffset: -0.1 };
    default:
      return { scale: 1.0, hoodZOffset: 0 };
  }
}
