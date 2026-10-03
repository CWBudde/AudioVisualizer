import {DEG} from '../../world/route';

export {DEG};
// Wick's crest (§2.3): the skyline of M1's 12 columns. Crest coordinates: x ∈ [−HALF, HALF] (12 columns of COL), y ∈ [0, 1]
// (column k is DEG[k] / 14 high), so the aspect is 120 : 84. ANCHOR sits in the solid block of columns 3–11 (inradius .25).
export const CREST_HALF = 60 / 84, CREST_COL = 2 * CREST_HALF / 12;
export const ANCHOR: [number, number] = [.18, .25];
export const crestHeight = (k: number) => DEG[k] / 14;

/** The skyline outline as a closed polygon from the base's left corner (up, along the tops, down), without repeated or collinear points. */
function outline() {
  const pts: [number, number][] = [[-CREST_HALF, 0]];
  DEG.forEach((_, k) => {const x0 = -CREST_HALF + k * CREST_COL; pts.push([x0, crestHeight(k)], [x0 + CREST_COL, crestHeight(k)]);});
  pts.push([CREST_HALF, 0]);
  const out: [number, number][] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (q && Math.abs(q[0] - p[0]) < 1e-9 && Math.abs(q[1] - p[1]) < 1e-9) continue;
    out.push(p);
  }
  // Drop points in the middle of a straight run (equal neighbouring columns).
  return out.filter((p, i) => {
    const a = out[(i + out.length - 1) % out.length], b = out[(i + 1) % out.length];
    return Math.abs((p[0] - a[0]) * (b[1] - a[1]) - (p[1] - a[1]) * (b[0] - a[0])) > 1e-9;
  });
}
const POLY = outline();
const f = (x: number) => x.toFixed(6);

/**
 * GLSL ES 3.00: crestSdf(q) is the exact signed distance (crest units, negative inside) to the crest silhouette;
 * crestColumn(q) is the column index under q.x (−1 outside); CREST_H[k] the column heights.
 */
export const CREST = `
const float CREST_HALF = ${f(CREST_HALF)}, CREST_COL = ${f(CREST_COL)};
const vec2 ANCHOR = vec2(${f(ANCHOR[0])}, ${f(ANCHOR[1])});
const float CREST_H[12] = float[12](${DEG.map((_, k) => f(crestHeight(k))).join(', ')});
const int CREST_N = ${POLY.length};
const vec2 CREST_V[${POLY.length}] = vec2[${POLY.length}](${POLY.map(([x, y]) => `vec2(${f(x)}, ${f(y)})`).join(', ')});
float crestSdf(vec2 p) {
  float d = dot(p - CREST_V[0], p - CREST_V[0]), s = 1.;
  for (int i = 0, j = CREST_N - 1; i < CREST_N; j = i, i++) {
    vec2 e = CREST_V[j] - CREST_V[i], w = p - CREST_V[i], b = w - e * clamp(dot(w, e) / dot(e, e), 0., 1.);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= CREST_V[i].y, p.y < CREST_V[j].y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s = -s;
  }
  return s * sqrt(d);
}
int crestColumn(vec2 q) {
  float k = floor((q.x + CREST_HALF) / CREST_COL);
  return k < 0. || k > 11. ? -1 : int(k);
}`;
