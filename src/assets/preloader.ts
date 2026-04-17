import { ASSET_MANIFEST, assetUrlFor, type AssetEntry } from './manifest';

/**
 * Preload all required assets with HEAD probes. Hard-fails on first
 * missing file — reported via errorBus so the modal shows.
 */
export async function preloadAllAssets(): Promise<void> {
  const failures: Array<{ entry: AssetEntry; url: string; reason: string }> = [];
  await Promise.all(
    ASSET_MANIFEST.map(async (entry) => {
      const url = assetUrlFor(entry);
      try {
        const res = await fetch(url, { method: 'HEAD', cache: 'force-cache' });
        if (!res.ok) {
          failures.push({ entry, url, reason: `HTTP ${res.status} ${res.statusText}` });
        }
      } catch (err) {
        failures.push({ entry, url, reason: err instanceof Error ? err.message : String(err) });
      }
    }),
  );
  if (failures.length > 0) {
    const detail = failures.map((f) => `  • ${f.entry.id} @ ${f.url} — ${f.reason}`).join('\n');
    throw new Error(`Missing required assets:\n${detail}`);
  }
}
