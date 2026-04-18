import { HONK } from '@/utils/constants';
import { audioBus } from './audioBus';

/**
 * Honk dispatch. One place to fire a honk; both audio + gameplay
 * (scare critters) subscribe.
 *
 * Horn sound routing: honkBus reads the active horn slug from the loadout
 * store and dispatches to the correct audioBus recipe. audioBus.playHonk()
 * is the default (classic-beep) path; additional slugs route to dedicated
 * Tone.js recipes defined in sfx.ts.
 */

type HonkHandler = () => void;
const handlers: HonkHandler[] = [];
let lastHonkAt = 0;

/** Override the horn slug for the current session (set from useLoadout). */
let _hornSlug = 'classic-beep';

export function setHornSlug(slug: string): void {
  _hornSlug = slug;
}

function playHornForSlug(slug: string): void {
  switch (slug) {
    case 'circus-fanfare':
      // Route through audioBus — it wraps Tone.js sfx
      audioBus.playHonk('circus-fanfare');
      break;
    case 'slide-whistle':
      audioBus.playHonk('slide-whistle');
      break;
    case 'air-horn':
      audioBus.playHonk('air-horn');
      break;
    default:
      // classic-beep and any unknown slug
      audioBus.playHonk();
      break;
  }
}

export function honk(): boolean {
  const now = performance.now();
  if (now - lastHonkAt < HONK.COOLDOWN_S * 1000) return false;
  lastHonkAt = now;
  playHornForSlug(_hornSlug);
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
