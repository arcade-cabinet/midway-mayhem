/**
 * @module config/schemaValidators
 *
 * Low-level validation helper functions for tunables.json fields.
 * Hand-rolled (no zod dependency). Each helper returns a string error
 * message on failure, or null on success.
 *
 * Extracted from schema.ts to keep that file under 300 LOC.
 */

/** Asserts `v` is a finite number matching optional bounds. Returns error string or null. */
export function assertNumber(
  v: unknown,
  path: string,
  opts: { positive?: boolean; min?: number; max?: number } = {},
): string | null {
  if (typeof v !== 'number' || !Number.isFinite(v))
    return `${path}: expected finite number, got ${JSON.stringify(v)}`;
  if (opts.positive && v <= 0) return `${path}: must be positive (> 0), got ${v}`;
  if (opts.min !== undefined && v < opts.min) return `${path}: must be >= ${opts.min}, got ${v}`;
  if (opts.max !== undefined && v > opts.max) return `${path}: must be <= ${opts.max}, got ${v}`;
  return null;
}

/** Asserts `v` is a string. Returns error string or null. */
export function assertString(v: unknown, path: string): string | null {
  if (typeof v !== 'string') return `${path}: expected string, got ${JSON.stringify(v)}`;
  return null;
}

/** Asserts `v` is a non-null, non-array object. Returns error string or null. */
export function assertObject(v: unknown, path: string): string | null {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    return `${path}: expected object, got ${JSON.stringify(v)}`;
  }
  return null;
}

/** Asserts `v` is an array. Returns error string or null. */
export function assertArray(v: unknown, path: string): string | null {
  if (!Array.isArray(v)) return `${path}: expected array, got ${JSON.stringify(v)}`;
  return null;
}

/** Collects non-null validation results into a string array. */
export function collect(...results: (string | null)[]): string[] {
  return results.filter((r): r is string => r !== null);
}
