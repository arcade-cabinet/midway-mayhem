/**
 * Haptic feedback — Capacitor Haptics on native iOS/Android, navigator.vibrate
 * fallback on mobile web, silent no-op on desktop.
 *
 * The Capacitor plugin ships with @capacitor/haptics. In web builds it
 * falls back to navigator.vibrate internally, so we just call it and
 * don't branch. If the plugin isn't available (desktop dev), we skip.
 */

type Intensity = 'light' | 'medium' | 'heavy';

async function triggerNative(intensity: Intensity): Promise<boolean> {
  try {
    // Dynamic import so the web bundle doesn't need to resolve the plugin.
    const mod = (await import(/* @vite-ignore */ '@capacitor/haptics')) as {
      Haptics: { impact: (opts: { style: string }) => Promise<void> };
      ImpactStyle: Record<string, string>;
    };
    const key = (intensity[0]?.toUpperCase() ?? '') + intensity.slice(1);
    const style = mod.ImpactStyle[key];
    if (!style) return false;
    await mod.Haptics.impact({ style });
    return true;
  } catch {
    return false;
  }
}

function triggerWeb(intensity: Intensity): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  const pattern = intensity === 'heavy' ? 90 : intensity === 'medium' ? 40 : 15;
  navigator.vibrate(pattern);
}

export async function haptic(intensity: Intensity): Promise<void> {
  const native = await triggerNative(intensity);
  if (!native) triggerWeb(intensity);
}
