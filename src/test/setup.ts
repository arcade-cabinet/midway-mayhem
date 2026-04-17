import '@testing-library/jest-dom/vitest';
import '@vitest/browser/matchers';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Filter out THREE.js console chatter that doesn't indicate real problems.
const origWarn = console.warn.bind(console);
const origError = console.error.bind(console);
const NOISE =
  /THREE\.(?:WebGLRenderer|Clock|WebGLShadowMap|GLTFLoader)|EXT_color_buffer_float|not wrapped in act/;

console.warn = (...args: unknown[]) => {
  if (NOISE.test(String(args[0] ?? ''))) return;
  origWarn(...args);
};
console.error = (...args: unknown[]) => {
  if (NOISE.test(String(args[0] ?? ''))) return;
  origError(...args);
};

afterEach(() => {
  cleanup();
});
