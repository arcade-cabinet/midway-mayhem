/**
 * HonkContext — lets the in-scene horn cap trigger the honk audio that
 * App owns a ref to. App provides; Cockpit's HonkableHorn consumes.
 *
 * Using a Context (not a global window handle) so the wiring stays React
 * and SSR-safe.
 */
import { createContext, useContext } from 'react';

export type HonkFn = () => void;

const noop: HonkFn = () => {};

export const HonkContext = createContext<HonkFn>(noop);

export function useHonk(): HonkFn {
  return useContext(HonkContext);
}
