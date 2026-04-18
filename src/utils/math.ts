export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function damp(current: number, target: number, tau: number, dt: number): number {
  if (!Number.isFinite(tau) || tau <= 0) {
    throw new Error(`damp: tau must be a finite number > 0 (got ${tau})`);
  }
  if (!Number.isFinite(dt) || dt < 0) {
    throw new Error(`damp: dt must be a finite number >= 0 (got ${dt})`);
  }
  const alpha = 1 - Math.exp(-dt / tau);
  return current + (target - current) * alpha;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (!Number.isFinite(edge0) || !Number.isFinite(edge1) || edge0 === edge1) {
    throw new Error(
      `smoothstep: edge0 and edge1 must be finite and distinct (got edge0=${edge0}, edge1=${edge1})`,
    );
  }
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function wrap(v: number, max: number): number {
  if (!Number.isFinite(max) || max <= 0) {
    throw new Error(`wrap: max must be a finite number > 0 (got ${max})`);
  }
  return ((v % max) + max) % max;
}

/** Clamp a 0–100 percentage value so GaugeBar stays render-only. */
export function clampPct(value: number): number {
  return value < 0 ? 0 : value > 100 ? 100 : value;
}

export function distSq2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}
