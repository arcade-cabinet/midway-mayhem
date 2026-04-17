import { reportError } from './errorBus';

/**
 * Haptics bus — the only component that fires device vibrations.
 *
 * On native Capacitor: uses @capacitor/haptics Taptic Engine / VibrationEffect
 * On mobile web:      uses navigator.vibrate with patterns
 * On desktop:         no-op (silently does nothing — no hardware)
 *
 * Not a fallback pattern — each platform gets the RIGHT API for its hardware.
 * Desktop no-op is intentional; we're not hiding errors.
 */

type HapticEvent =
  | 'crash-light'
  | 'crash-heavy'
  | 'boost'
  | 'mega-boost'
  | 'pickup-ticket'
  | 'honk'
  | 'game-over'
  | 'zone-transition';

interface Pattern {
  /** Web Vibration API pattern (ms) */
  web: number | number[];
  /** Capacitor Haptics impact style */
  impact?: 'light' | 'medium' | 'heavy';
  /** Capacitor Haptics notification type */
  notify?: 'success' | 'warning' | 'error';
  /** Use selectionChanged() — a soft click */
  selection?: boolean;
}

const PATTERNS: Record<HapticEvent, Pattern> = {
  'crash-light': { web: 40, impact: 'light' },
  'crash-heavy': { web: [80, 30, 40], impact: 'heavy', notify: 'error' },
  boost: { web: 20, selection: true },
  'mega-boost': { web: [20, 50, 30, 50, 60], impact: 'heavy' },
  'pickup-ticket': { web: 15, selection: true },
  honk: { web: 15, selection: true },
  'game-over': { web: [150, 50, 200], notify: 'error' },
  'zone-transition': { web: [20, 40, 20], impact: 'medium' },
};

class HapticsBus {
  private enabled = true;
  private capacitorHaptics: unknown = null;

  async init(): Promise<void> {
    // biome-ignore lint/suspicious/noExplicitAny: Capacitor runtime detection
    const cap = (globalThis as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      try {
        const { Haptics } = await import('@capacitor/haptics');
        this.capacitorHaptics = Haptics;
      } catch (err) {
        reportError(err, 'hapticsBus.init (Capacitor)');
      }
    }
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
  }

  fire(event: HapticEvent): void {
    if (!this.enabled) return;
    const p = PATTERNS[event];
    // Prefer Capacitor on native
    if (this.capacitorHaptics) {
      const H = this.capacitorHaptics as {
        impact?: (opts: { style: string }) => Promise<void>;
        notification?: (opts: { type: string }) => Promise<void>;
        selectionChanged?: () => Promise<void>;
      };
      if (p.impact && H.impact) {
        H.impact({ style: p.impact.toUpperCase() }).catch((err: unknown) =>
          reportError(err, `hapticsBus.fire(${event}) — Capacitor impact`),
        );
        return;
      }
      if (p.notify && H.notification) {
        H.notification({ type: p.notify.toUpperCase() }).catch((err: unknown) =>
          reportError(err, `hapticsBus.fire(${event}) — Capacitor notification`),
        );
        return;
      }
      if (p.selection && H.selectionChanged) {
        H.selectionChanged().catch((err: unknown) =>
          reportError(err, `hapticsBus.fire(${event}) — Capacitor selectionChanged`),
        );
        return;
      }
    }
    // Web Vibration API — works on mobile browsers, no-op on desktop
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(p.web);
      } catch {
        // silent — some browsers block vibrate during autoplay-restricted contexts
      }
    }
  }
}

export const hapticsBus = new HapticsBus();

export function initHapticsSafely(): void {
  hapticsBus.init().catch((err: unknown) => reportError(err, 'hapticsBus.init'));
}
