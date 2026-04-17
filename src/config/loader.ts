import { reportError } from '../systems/errorBus';
import { type Tunables, parseTunables } from './schema';

/**
 * loadTunables — fetch public/config/tunables.json (or override via ?config=<url>),
 * validate against the schema, and return a frozen Tunables object.
 *
 * Hard-fails via errorBus on network error or schema validation failure.
 * Supports ?config=<url> URL param for live designer tuning without rebuild.
 */
export async function loadTunables(defaultUrl?: string): Promise<Tunables> {
  const override =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('config')
      : null;

  const base: string =
    typeof import.meta !== 'undefined' && typeof import.meta.env?.BASE_URL === 'string'
      ? import.meta.env.BASE_URL
      : '/';

  const baseUrl = base.endsWith('/') ? base : `${base}/`;
  const url = override ?? defaultUrl ?? `${baseUrl}config/tunables.json`;

  let raw: unknown;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ${resp.statusText} fetching tunables from ${url}`);
    }
    raw = await resp.json();
  } catch (err) {
    reportError(err, 'config/loader: fetch');
    throw err;
  }

  const result = parseTunables(raw);
  if (!result.ok) {
    const err = new Error(result.error);
    reportError(err, 'config/loader: validate');
    throw err;
  }

  return Object.freeze(result.data) as Tunables;
}
