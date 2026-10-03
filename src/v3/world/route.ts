import type {Vec3} from '../engine/frame';
import {smoothstep} from '../engine/easing';
import type {Frame3, World} from './types';

// The route (§2.2): the skyline of M1's 12 columns, one tile per lead note. Real, not a stub.

export const L = 441, DEG = [14, 7, 2, 11, 7, 8, 9, 8, 9, 7, 7, 8], U = 6, W = 10;
/** Route vertices [arc, X, Z]: axis-aligned segments, integer tiles. 370 is a column seam (no turn). */
export const VERTICES: readonly (readonly [number, number, number])[] = [
  [0, -60, 42], [84, -60, -42], [94, -50, -42], [136, -50, 0], [146, -40, 0], [176, -40, 30], [186, -30, 30], [240, -30, -24],
  [250, -20, -24], [274, -20, 0], [284, -10, 0], [290, -10, -6], [300, 0, -6], [306, 0, -12], [316, 10, -12], [322, 10, -6],
  [332, 20, -6], [338, 20, -12], [348, 30, -12], [360, 30, 0], [370, 40, 0], [380, 50, 0], [386, 50, -6], [396, 60, -6], [441, 60, 39],
];
const last = VERTICES.length - 1;
/** Index of the segment [V[i], V[i+1]) holding arc s, for 0 ≤ s < L. */
const segmentOf = (s: number) => {let i = 0; while (i < last - 1 && VERTICES[i + 1][0] <= s) i++; return i;};
export const rightOf = (h: Vec3): Vec3 => [-h[2], 0, h[0]];

/** Crisp route point at arc s (y = 0). South (+Z) of the start for s < 0, along the final tangent past L. */
export function routePoint(s: number): Vec3 {
  if (s <= 0) return [-60, 0, 42 - s];
  if (s >= L) return [60, 0, 39 + (s - L)];
  const i = segmentOf(s), [a0, x0, z0] = VERTICES[i], [a1, x1, z1] = VERTICES[i + 1], k = (s - a0) / (a1 - a0);
  return [x0 + (x1 - x0) * k, 0, z0 + (z1 - z0) * k];
}
/** Crisp frame: routePoint plus the heading of the segment s lies on (the heading after a vertex). Wick turns like a sprite. */
export function routeCrisp(s: number): Frame3 {
  let h: Vec3;
  if (s < 0) h = [0, 0, -1];
  else if (s >= L) h = [0, 0, 1];
  else {const i = segmentOf(s), [, x0, z0] = VERTICES[i], [, x1, z1] = VERTICES[i + 1], n = Math.hypot(x1 - x0, z1 - z0); h = [(x1 - x0) / n, 0, (z1 - z0) / n];}
  return {p: routePoint(s), h, r: rightOf(h)};
}

// Smoothed frame: box average over [s − 8, s + 8] (33 samples), tabulated at .25 arc over [−240, 500].
const S0 = -240, S1 = 500, STEP = .25, N = Math.round((S1 - S0) / STEP) + 1;
let table: {p: Float64Array; h: Float64Array} | null = null;
function smoothTable() {
  if (table) return table;
  // Points from S0 − .5 to S1 + .5, so the heading at entry i is the difference of entries i ± 2.
  const M = N + 4, sp = new Float64Array(M * 3);
  for (let i = 0; i < M; i++) {
    const s = S0 + (i - 2) * STEP;
    for (let j = -16; j <= 16; j++) {const q = routePoint(s + .5 * j); sp[i * 3] += q[0] / 33; sp[i * 3 + 2] += q[2] / 33;}
  }
  const p = new Float64Array(N * 3), h = new Float64Array(N * 3);
  for (let i = 0; i < N; i++) {
    p[i * 3] = sp[(i + 2) * 3]; p[i * 3 + 2] = sp[(i + 2) * 3 + 2];
    const dx = sp[(i + 4) * 3] - sp[i * 3], dz = sp[(i + 4) * 3 + 2] - sp[i * 3 + 2], n = Math.hypot(dx, dz);
    h[i * 3] = dx / n; h[i * 3 + 2] = dz / n;
  }
  return table = {p, h};
}
/** Smoothed route frame at arc s: formations and cameras use this so nothing snaps at the 90° corners. */
export function routeFrame(s: number): Frame3 {
  const {p, h} = smoothTable();
  const x = Math.min(Math.max((s - S0) / STEP, 0), N - 1), i = Math.min(Math.floor(x), N - 2), k = x - i, over = s - Math.min(Math.max(s, S0), S1);
  const at = (a: Float64Array, c: number) => a[i * 3 + c] + (a[(i + 1) * 3 + c] - a[i * 3 + c]) * k;
  const hx = at(h, 0), hz = at(h, 2), n = Math.hypot(hx, hz), dir: Vec3 = [hx / n, 0, hz / n];
  // Outside the table: extrapolate along the end heading.
  return {p: [at(p, 0) + dir[0] * over, 0, at(p, 2) + dir[2] * over], h: dir, r: rightOf(dir)};
}

/** The causeway stair (§2.2): seven .4 steps from arc 375 rising just before each note of the 72.0–73.2 run, lowered over 82.35–84.0. */
export function causewayY(w: World, s: number, t: number) {
  let y = 0;
  for (let j = 0; j <= 6; j++) {
    const T = w.noteStart[375 + j];
    if (T === undefined || s < 375 + j) break;
    y += .4 * smoothstep(T - .12, T, t);
  }
  return y * (1 - smoothstep(82.35, 84, t));
}
