import { useEffect, useState } from 'react';
import { reportError } from '@/game/errorBus';

export interface DeviceInfo {
  isNative: boolean;
  platform: 'web' | 'ios' | 'android';
  model: string | null;
  osVersion: string | null;
  isTouch: boolean;
  isMobile: boolean;
  gpuRenderer: string | null;
  webViewVersion: string | null;
}

export function useDeviceDetection(): DeviceInfo | null {
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  useEffect(() => {
    detect()
      .then(setInfo)
      .catch((err) => reportError(err, 'useDeviceDetection'));
  }, []);
  return info;
}

async function detect(): Promise<DeviceInfo> {
  let isNative = false;
  let platform: DeviceInfo['platform'] = 'web';
  let model: string | null = null;
  let osVersion: string | null = null;
  let webViewVersion: string | null = null;

  // biome-ignore lint/suspicious/noExplicitAny: Capacitor is injected at runtime on native
  const cap = (globalThis as any).Capacitor;
  if (cap?.isNativePlatform?.()) {
    isNative = true;
    const p = cap.getPlatform?.();
    if (p === 'ios' || p === 'android') platform = p;

    // Pull richer Device info when on native
    try {
      const { Device } = await import('@capacitor/device');
      const d = await Device.getInfo();
      model = d.model ?? null;
      osVersion = d.osVersion ?? null;
      webViewVersion = d.webViewVersion ?? null;
    } catch (err) {
      reportError(err, 'Device.getInfo');
    }
  }

  const isTouch =
    typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  // WebGL is REQUIRED — hard-fail if unavailable
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  if (!gl) {
    throw new Error(
      '[device] WebGL not available — Midway Mayhem requires a WebGL-capable browser',
    );
  }
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const gpuRenderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : null;

  return {
    isNative,
    platform,
    model,
    osVersion,
    isTouch,
    isMobile,
    gpuRenderer,
    webViewVersion,
  };
}
