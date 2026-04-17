import { useEffect, useState } from 'react';
import { reportError } from '../systems/errorBus';

export interface DeviceInfo {
  isNative: boolean;
  platform: 'web' | 'ios' | 'android';
  isTouch: boolean;
  isMobile: boolean;
  gpuRenderer: string | null;
}

export function useDeviceDetection(): DeviceInfo | null {
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  useEffect(() => {
    try {
      setInfo(detect());
    } catch (err) {
      reportError(err, 'useDeviceDetection');
    }
  }, []);
  return info;
}

function detect(): DeviceInfo {
  let isNative = false;
  let platform: DeviceInfo['platform'] = 'web';

  // biome-ignore lint/suspicious/noExplicitAny: Capacitor injects at runtime
  const cap = (globalThis as any).Capacitor;
  if (cap && typeof cap.isNativePlatform === 'function') {
    isNative = cap.isNativePlatform();
    const p = cap.getPlatform?.();
    if (p === 'ios' || p === 'android') platform = p;
  }

  const isTouch =
    typeof window !== 'undefined' &&
    ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  // WebGL is REQUIRED — if it fails, hard-fail up to errorBus
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
  if (!gl) {
    throw new Error('[device] WebGL not available — Midway Mayhem requires a WebGL-capable browser');
  }
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const gpuRenderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : null;

  return { isNative, platform, isTouch, isMobile, gpuRenderer };
}
