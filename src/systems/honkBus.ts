import { HONK } from '../utils/constants';
import { audioBus } from './audioBus';

/**
 * Honk dispatch. One place to fire a honk; both audio + gameplay
 * (scare critters) subscribe.
 */

type HonkHandler = () => void;
const handlers: HonkHandler[] = [];
let lastHonkAt = 0;

export function honk(): boolean {
  const now = performance.now();
  if (now - lastHonkAt < HONK.COOLDOWN_S * 1000) return false;
  lastHonkAt = now;
  audioBus.playHonk();
  for (const h of handlers) h();
  return true;
}

export function onHonk(h: HonkHandler): () => void {
  handlers.push(h);
  return () => {
    const i = handlers.indexOf(h);
    if (i >= 0) handlers.splice(i, 1);
  };
}
