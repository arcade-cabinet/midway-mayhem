import '@testing-library/jest-dom/vitest';
import '@vitest/browser/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

const originalWarn = console.warn.bind(console);
const originalError = console.error.bind(console);

function isKnownNoise(msg: string): boolean {
  return (
    msg.includes('THREE.WebGLRenderer') ||
    msg.includes('EXT_color_buffer_float') ||
    msg.includes('THREE.Clock') ||
    msg.includes('THREE.WebGLShadowMap') ||
    msg.includes("THREE.GLTFLoader: Couldn't load texture") ||
    msg.includes('not wrapped in act')
  );
}

console.warn = (...args: unknown[]) => {
  const msg = String(args[0] ?? '');
  if (isKnownNoise(msg)) return;
  originalWarn(...args);
};

console.error = (...args: unknown[]) => {
  const msg = String(args[0] ?? '');
  if (isKnownNoise(msg)) return;
  originalError(...args);
};

afterEach(() => {
  cleanup();
});
