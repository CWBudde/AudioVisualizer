import {hash01} from '../engine/random';
import {wickArc} from './clock';
import {DEG, L, routeFrame, routePoint, U, VERTICES, W} from './route';
import type {World} from './types';

// The plain's static tables (§2.4): per-cell arc/lateral/crest and up to 8 light events per cell.

export const TILES = 160, MAX_EVENTS = 8, HALF = 80;
/** Event kinds packed as kind · 128 + time (§2.4). */
export const EVENT = {contact: 1, contactCold: 2, wake: 3, stampAmber: 4, stampCrimson: 5, blink: 6, crestFill: 7, answer: 8} as const;
/** Cell index of integer world (X, Z), −1 outside the 160 × 160 grid. */
export const cellOf = (X: number, Z: number) => {
  const i = Math.round(X) + HALF, j = Math.round(Z) + HALF;
  return i < 0 || j < 0 || i >= TILES || j >= TILES ? -1 : j * TILES + i;
};
export const cellX = (c: number) => c % TILES - HALF, cellZ = (c: number) => Math.floor(c / TILES) - HALF;

export type TileTag = 'contact' | 'wake' | 'chevron' | 'ring' | 'hammer' | 'answer' | 'flicker' | 'blink' | 'lock' | 'fill';
/** Where each event came from (`id`: chevron/ring/hammer-hit/snare index…); for validation and look-dev. */
export type TileSource = {tag: TileTag; kind: number; time: number; cell: number; id: number};
export type TileReport = {sources: TileSource[]; dropped: TileSource[]; maxPerCell: number; isRoute: Uint8Array};
const reports = new WeakMap<World['tiles'], TileReport>();
/** The event sources of a built tile table (kept events in `sources`, events dropped by the 8-per-cell cap in `dropped`). */
export const tileReport = (tiles: World['tiles']) => reports.get(tiles);

/** Crest membership (inclusive outline) of world cell (X, Z): columns of width W, heights DEG·U over the base Z = 42. */
function inCrest(X: number, Z: number) {
  const x = X + 60, h = 42 - Z;
  if (x < 0 || x > 120 || h < 0) return false;
  const k = Math.min(Math.floor(x / W), 11), top = U * DEG[k];
  // On a seam the taller neighbour counts (the outline runs down it).
  const seam = x % W === 0 && k > 0 ? U * DEG[k - 1] : 0;
  return h <= Math.max(top, seam);
}

/** Nearest crisp-route arc and signed lateral (along r) for a point. */
function nearest(X: number, Z: number) {
  let best = Infinity, arc = 0, lat = 0;
  for (let i = 0; i + 1 < VERTICES.length; i++) {
    const [a0, x0, z0] = VERTICES[i], [a1, x1, z1] = VERTICES[i + 1], len = a1 - a0;
    const hx = (x1 - x0) / len, hz = (z1 - z0) / len;
    const u = Math.min(Math.max((X - x0) * hx + (Z - z0) * hz, 0), len);
    const px = x0 + hx * u, pz = z0 + hz * u, d = (X - px) ** 2 + (Z - pz) ** 2;
    if (d < best - 1e-9) {best = d; arc = a0 + u; lat = (X - px) * -hz + (Z - pz) * hx;}
  }
  return {arc, lat};
}

/** Every event source of §2.4 / §2.6, then packed (sorted by time, ≤ 8 per cell) into the two RGBA tables. */
export function buildTiles(w: World): World['tiles'] {
  const n = TILES * TILES, arc = new Float32Array(n), lateral = new Float32Array(n), crest = new Uint8Array(n), isRoute = new Uint8Array(n);
  for (let c = 0; c < n; c++) {
    const X = cellX(c), Z = cellZ(c), q = nearest(X, Z);
    arc[c] = q.arc; lateral[c] = q.lat; crest[c] = +inCrest(X, Z);
  }
  const routeCell = (i: number) => {const p = routePoint(i); return cellOf(p[0], p[2]);};
  for (let i = 0; i <= L; i++) isRoute[routeCell(i)] = 1;
  const A = (t: number) => wickArc(w, t);
  const all: TileSource[] = [];
  const add = (tag: TileTag, kind: number, time: number, cell: number, id = 0) => {if (cell >= 0) all.push({tag, kind, time, cell, id});};
  const addAt = (tag: TileTag, kind: number, time: number, X: number, Z: number, id = 0) => add(tag, kind, time, cellOf(X, Z), id);

  // Contact: note i lights route cell i (cold violet before the first breath ends).
  for (let i = 0; i <= Math.min(w.final, w.noteStart.length - 1); i++) {
    const t = w.noteStart[i], p = routePoint(w.noteArc[i]);
    addAt('contact', t < 9.17 ? EVENT.contactCold : EVENT.contact, t, p[0], p[2], i);
  }
  // Wake: each walker's home cell flashes when it stands.
  const Wk = w.walkers;
  for (let k = 0; k < Wk.count; k++) {
    const f = routeFrame(Wk.homeArc[k]), l = Wk.homeLat[k];
    addAt('wake', EVENT.wake, Wk.wake[k], f.p[0] + f.r[0] * l, f.p[2] + f.r[2] * l, k);
  }
  // Chevrons (M2): left arm on beats 1–2, apex and right arm on beats 3–4; #5 is crimson.
  w.m2.forEach(({start: T}, m) => {
    const f = routeFrame(A(T) + 6), lc = m < 3 ? -3 : 0, kind = m === 4 ? EVENT.stampCrimson : EVENT.stampAmber;
    const P = [f.p[0] + f.r[0] * lc, f.p[2] + f.r[2] * lc];
    addAt('chevron', kind, T + 1.143, P[0], P[1], m);
    for (let j = 1; j <= 4; j++) {
      addAt('chevron', kind, T + .143 * j, P[0] - f.h[0] * j - f.r[0] * j, P[1] - f.h[2] * j - f.r[2] * j, m);
      addAt('chevron', kind, T + 1.143 + .143 * j, P[0] - f.h[0] * j + f.r[0] * j, P[1] - f.h[2] * j + f.r[2] * j, m);
    }
  });
  // Loop rings (M4): an annulus swept clockwise from behind the head, closing at T_c = start + 1.
  w.m4.slice(0, 3).forEach(({start}, m) => {
    const Tc = start + 1, R = [4, 7, 10][m], f = routeFrame(A(Tc)), [cx, , cz] = f.p;
    for (let Z = Math.floor(cz - R - 1); Z <= cz + R + 1; Z++) for (let X = Math.floor(cx - R - 1); X <= cx + R + 1; X++) {
      const vx = X - cx, vz = Z - cz;
      if (Math.abs(Math.hypot(vx, vz) - R) > .5) continue;
      // θ from −h, clockwise seen from above (−h → −r → h → r).
      let th = Math.atan2(-(vx * f.r[0] + vz * f.r[2]), -(vx * f.h[0] + vz * f.h[2]));
      if (th < 0) th += 2 * Math.PI;
      addAt('ring', EVENT.stampAmber, start + th / (2 * Math.PI), X, Z, m);
    }
  });
  // The answer tile.
  add('answer', EVENT.answer, 60.24, cellOf(w.answerHome[0], w.answerHome[2]));
  // Fill flicker: 7 off-route cells per hit in an 8–16 tile annulus around Wick; distant blinks: 9 cells at 25–45.
  const scatter = (tag: TileTag, times: number[], count: number, r0: number, r1: number, salt: number) => times.forEach((T, m) => {
    const p = routePoint(A(T)), used = new Set<number>();
    for (let j = 0; used.size < count && j < 400; j++) {
      const th = 2 * Math.PI * hash01(salt + m, 2 * j), r = r0 + (r1 - r0) * hash01(salt + m, 2 * j + 1);
      const c = cellOf(p[0] + r * Math.cos(th), p[2] + r * Math.sin(th));
      if (c < 0 || isRoute[c] || used.has(c)) continue;
      used.add(c); add(tag, EVENT.blink, T, c, m);
    }
  });
  scatter('flicker', [8.03, 8.18, 8.315, 8.465, 8.60, 62.89, 63.045, 63.175, 63.46], 7, 8, 16, 0xf111);
  scatter('blink', [55.33, 55.46, 55.905, 56.205, 56.605], 9, 25, 45, 0xb11c);
  // The lock: every route cell relights in a ripple back from the landing; then the crest interior fills top-down.
  for (let i = 0; i <= L; i++) add('lock', EVENT.stampAmber, 84.615 + (L - i) * .0015, routeCell(i), i);
  for (let c = 0; c < n; c++) if (crest[c] && !isRoute[c]) add('fill', EVENT.crestFill, 84.9 + .7 * (cellZ(c) + 42) / 84, c);

  // Hammer (M6), added last: each of the 8 D hits per bar lights ~40 % of a band 6–16 tiles ahead of the line, but only
  // cells with room left under the 8-event cap (so nothing else is ever dropped for a flash).
  // Same-kind events within a frame in one cell (walkers sharing a home cell at a corner) light it once.
  const seen = new Set<string>();
  const unique = all.filter(e => {const key = `${e.cell}:${e.kind}:${Math.round(e.time * 60)}`; if (seen.has(key)) return false; seen.add(key); return true;});
  all.length = 0; all.push(...unique);
  const used = new Uint8Array(n);
  for (const e of all) used[e.cell]++;
  let hit = 0;
  for (const {start, hits} of w.m6) {
    const a0 = A(start);
    for (const T of hits) {
      for (let c = 0; c < n; c++) if (arc[c] >= a0 + 6 && arc[c] <= a0 + 16 && Math.abs(lateral[c]) <= 4 && hash01(c, hit) < .4 && used[c] < MAX_EVENTS) {add('hammer', EVENT.stampCrimson, T, c, hit); used[c]++;}
      hit++;
    }
  }
  // Pack: per cell sorted by time; over the cap, drop the unprotected event that is shown the shortest (closest successor).
  const byCell = new Map<number, TileSource[]>();
  for (const e of all) {let list = byCell.get(e.cell); if (!list) byCell.set(e.cell, list = []); list.push(e);}
  const events: [Float32Array, Float32Array] = [new Float32Array(n * 4).fill(-1), new Float32Array(n * 4).fill(-1)];
  const sources: TileSource[] = [], dropped: TileSource[] = [];
  const keep = (e: TileSource) => e.tag === 'contact' || e.tag === 'answer' || e.tag === 'lock';
  let maxPerCell = 0;
  for (const [c, list] of byCell) {
    list.sort((a, b) => a.time - b.time);
    while (list.length > MAX_EVENTS) {
      let worst = -1, gap = Infinity;
      for (let i = 0; i < list.length; i++) {
        if (keep(list[i])) continue;
        const g = (list[i + 1]?.time ?? 1e9) - list[i].time;
        if (g < gap) {gap = g; worst = i;}
      }
      if (worst < 0) worst = 0;
      dropped.push(...list.splice(worst, 1));
    }
    maxPerCell = Math.max(maxPerCell, list.length);
    list.forEach((e, i) => {events[i >> 2][c * 4 + (i & 3)] = e.kind * 128 + e.time; sources.push(e);});
  }
  const tiles: World['tiles'] = {size: TILES, events, arc, lateral, crest};
  reports.set(tiles, {sources, dropped, maxPerCell, isRoute});
  return tiles;
}
