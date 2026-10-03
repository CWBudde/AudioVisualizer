import {easeOutCubic, smoothstep as ss} from '../engine/easing';
import {hash01} from '../engine/random';
import {heldTime, lastAtOrBefore, wickArc} from './clock';
import {causewaySteps, routeFrameInto} from './route';
import type {WalkerTable, World} from './types';

// Walkers (§2.5): a static cohort/slot table and walkerPose, a pure function of held time. No simulation history.

export const WALKERS = 2048, POSE = 8; // pose stride: [x, y, z, yaw, lie, stand, head, spark]
/** Key times of the walker story. */
export const WT = {f1: 9.1685, f1End: 11.467, f2: 18.311, f2End: 20.609, drift: 36.6, driftEnd: 48.038, snap: 44.03, drop: 45.752, rest: 54.9, rise: 64.038, stop: 82.35} as const;
/** Distant soft snares: cohort 2 walker k lights (lying) at REST_LIGHT[k mod 5]. */
export const REST_LIGHT = [55.33, 55.46, 55.905, 56.205, 56.605];
const SIDE_STEPS = [18.324, 22.895, 27.467], POP = 4 / 60, TAU = Math.PI * 2;
const GUARD_WAKE = 18.315;

const firstAtOrAfter = (times: Float64Array, t: number) => times[lastAtOrBefore(times, t - 1e-9) + 1] ?? t;

/**
 * The cohort/slot table of §2.5. Cohort 0 (trail, 0–45) and 1 (guards, 46–199) share F2 lanes (even k left) and rows ⌊k/2⌋;
 * cohort 2 (plain, 200–2047) fills the remaining F3 slots row-major, skipping lanes 1 and 7 in rows 36–135.
 */
export function buildWalkers(w: World): WalkerTable {
  const n = WALKERS, f = () => new Float32Array(n);
  const t: WalkerTable = {count: n, cohort: new Uint8Array(n), homeArc: f(), homeLat: f(), wake: f(), restLight: f(), b1a: f(), b1b: f(), b2: f(), l2: f(), row2: new Uint16Array(n), b3: f(), l3: f(), seed: f()};
  const A = (x: number) => wickArc(w, x), a9 = A(WT.f1), a18 = A(WT.f2), shift = A(WT.rise) - A(WT.rest);
  const trailWake = firstAtOrAfter(w.kicks, WT.f1);
  // T_reach(x): when Wick's arc reaches x (the start of note ⌈x⌉); everything already passed at the breath reads 9.17.
  const reach = (x: number) => x <= 46 ? trailWake : w.noteStart[Math.min(Math.ceil(x - 1e-6), w.noteStart.length - 1)];
  for (let k = 0; k < 200; k++) {
    const row = k >> 1, l2 = k % 2 ? 3 : -3, b2 = 2 + row;
    t.cohort[k] = k < 46 ? 0 : 1; t.row2[k] = row; t.b2[k] = b2; t.l2[k] = l2; t.b3[k] = b2 + shift; t.l3[k] = l2;
    if (k < 46) {
      t.homeArc[k] = 45 - k; t.homeLat[k] = 0; t.wake[k] = trailWake;
      t.b1a[k] = a9 - (45 - k); t.b1b[k] = 1 + .6 * k;
    } else {
      t.homeArc[k] = a18 - b2; t.homeLat[k] = l2;
      t.wake[k] = Math.min(GUARD_WAKE, firstAtOrAfter(w.kicks, reach(t.homeArc[k] + 28.6)));
    }
  }
  let k = 200;
  for (let r = 0; r < 228 && k < n; r++) for (let j = 0; j < 9 && k < n; j++) {
    if ((j === 1 || j === 7) && r >= 36 && r <= 135) continue;
    t.cohort[k] = 2; t.b3[k] = 2 + r; t.l3[k] = j - 4; t.b2[k] = t.b3[k]; t.l2[k] = t.l3[k]; t.row2[k] = r;
    t.homeArc[k] = A(WT.rise) - t.b3[k]; t.homeLat[k] = t.l3[k]; t.wake[k] = WT.rise; t.restLight[k] = REST_LIGHT[k % 5];
    k++;
  }
  for (let i = 0; i < n; i++) t.seed[i] = hash01(0x5eed, i);
  return t;
}

/** Per-World constants the pose needs (arcs at key times), computed once. */
type Consts = {a36: number; a4575: number; aStop: number; aRest: number; homeX: Float32Array; homeZ: Float32Array; homeYaw: Float32Array};
const consts = new WeakMap<World, Consts>();
const fr = new Float64Array(4);
function constsOf(w: World): Consts {
  let c = consts.get(w);
  if (c) return c;
  const W = w.walkers, n = W.count, homeX = new Float32Array(n), homeZ = new Float32Array(n), homeYaw = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    // Cohorts 0/1 wait at home; cohort 2 rests at home: same place either way.
    routeFrameInto(W.homeArc[k], fr);
    homeX[k] = fr[0] - fr[3] * W.homeLat[k]; homeZ[k] = fr[1] + fr[2] * W.homeLat[k]; homeYaw[k] = Math.atan2(fr[2], fr[3]);
  }
  c = {a36: wickArc(w, WT.drift), a4575: wickArc(w, WT.drop), aStop: wickArc(w, WT.stop), aRest: w.aRest, homeX, homeZ, homeYaw};
  consts.set(w, c);
  return c;
}

/** Per-frame shared inputs, computed once per τ. */
type Frame = {tau: number; A: number; kick: number; snare: number; hat: number; steps: Float32Array; sparkle: number};
const hop = (a: number) => a >= 0 && a <= .2 ? Math.sin(Math.PI * a / .2) : 0;
const mixv = (a: number, b: number, x: number) => a + (b - a) * x;
const P = new Float64Array(3);
/** Route position at arc s, lateral l into P (x, z) and the heading's yaw; returns the yaw. */
function at(s: number, l: number) {
  routeFrameInto(s, fr);
  P[0] = fr[0] - fr[3] * l; P[2] = fr[1] + fr[2] * l;
  return Math.atan2(fr[2], fr[3]);
}
const causeAt = (f: Frame, s: number) => {let y = 0; for (let j = 0; j < 7; j++) if (s >= 375 + j) y += f.steps[j]; return y;};

function frameAt(w: World, t: number): Frame {
  const tau = heldTime(t);
  return {tau, A: wickArc(w, tau), kick: lastAtOrBefore(w.kicks, tau), snare: lastAtOrBefore(w.snares, tau), hat: lastAtOrBefore(w.hats, tau),
    steps: causewaySteps(w, tau, stepsBuf), sparkle: tau < WT.stop ? 1 : 0};
}
const stepsBuf = new Float32Array(7);

/** One walker's pose into out[o … o + 7]: [x, y, z, yaw, lie, stand, head, spark] (§2.5 rules 1–8). */
function pose(w: World, c: Consts, f: Frame, k: number, out: Float32Array | number[], o: number) {
  const W = w.walkers, co = W.cohort[k], seed = W.seed[k], {tau, A} = f;
  // 1. Not visible: parked at home.
  if (tau < (co === 2 ? W.restLight[k] : W.wake[k])) {
    out[o] = c.homeX[k]; out[o + 1] = 0; out[o + 2] = c.homeZ[k]; out[o + 3] = c.homeYaw[k];
    out[o + 4] = co === 2 ? 1 : 0; out[o + 5] = 0; out[o + 6] = 0; out[o + 7] = 0;
    return;
  }
  // 2. Resting: cohort 2 before the rise; cohorts 0/1 lie down where they stopped at 54.9.
  if (co === 2 ? tau < WT.rise : tau >= WT.rest && tau < WT.rise) {
    const sit = ss(62.89, 63.19, tau);
    let x: number, z: number, yaw: number, lie: number, head: number, stand = 1;
    if (co === 2) {
      x = c.homeX[k]; z = c.homeZ[k]; yaw = c.homeYaw[k]; lie = 1;
      const age = tau - W.restLight[k];
      head = .3 + 1.2 * Math.exp(-age / .4);
      stand = ss(W.restLight[k] - 1e-6, W.restLight[k] + POP, tau);
    } else {
      yaw = at(c.aRest - W.b2[k], W.l2[k]); x = P[0]; z = P[2];
      lie = ss(WT.rest, 55.5, tau); head = mixv(1, .3, lie);
    }
    out[o] = x; out[o + 1] = 0; out[o + 2] = z; out[o + 3] = yaw;
    out[o + 4] = lie - .5 * sit; out[o + 5] = stand; out[o + 6] = head + .3 * sit; out[o + 7] = 0;
    return;
  }
  // 3. Stand-up (the pop hides under a head flash); at the rise everyone sits up the last half over 4 frames.
  const wake = W.wake[k];
  // The 2,048-strong rise flashes softer than the trail's: summed over the plain it would blow out the 64.04 iris.
  let stand = co === 2 ? 1 : ss(wake - 1e-6, wake + POP, tau), head = 1 + (co === 2 && wake === WT.rise ? .4 : 1.5) * Math.exp(-(tau - wake) / .2);
  let lie = tau >= WT.rise ? .5 * (1 - ss(WT.rise, WT.rise + POP, tau)) : 0;
  // 4. March arc.
  let s: number, l: number, b: number;
  if (tau >= WT.rise) {
    b = W.b3[k]; l = W.l3[k];
    if (tau >= WT.stop) {s = c.aStop - b; const down = ss(WT.stop, 83, tau); lie = down; head = mixv(head, .6, down);} else s = A - b;
  } else if (co === 1 && tau < WT.f2) {
    b = A - W.homeArc[k]; s = W.homeArc[k]; l = W.l2[k];
  } else {
    const k2 = co === 0 ? ss(WT.f2, WT.f2End, tau) : 1;
    const b1 = co === 0 ? (tau < WT.f1 ? W.b1a[k] : mixv(W.b1a[k], W.b1b[k], ss(WT.f1, WT.f1End, tau))) : 0;
    b = mixv(b1, W.b2[k], k2); l = W.l2[k] * k2;
    s = Math.max(W.homeArc[k], A - b);
    // M2 side-step of the left lane in the interlocking scene: sideways, then forward.
    if (W.l2[k] < 0 && tau >= WT.f2 && tau < WT.drift) for (const T of SIDE_STEPS) l -= 1.5 * k2 * Math.sin(Math.PI * Math.min(Math.max((tau - T) / 2.2857, 0), 1));
  }
  let yaw = at(s, l), x = P[0], z = P[2], y = causeAt(f, s);
  // 5. Drift override (cohorts 0/1): float behind Wick, gather above the future walls, snap into two grids, drop into F2.
  if (co < 2 && tau >= WT.drift && tau < WT.driftEnd) {
    const row = W.row2[k], l2 = W.l2[k];
    at(c.a36 - W.b2[k] + .85 * (A - c.a36), l2 + 2.5 * (seed - .5) * ss(WT.drift, 38, tau));
    let dx = P[0], dz = P[2];
    const rise = 7 * (.6 + .4 * seed) * ss(41.18, 43.2, tau);
    let dy = ss(WT.drift, 37.5, tau) * (.5 + .6 * Math.sin(.7 * tau + TAU * seed)) + rise;
    const col = Math.floor(row / 4), wr = row % 4;
    at(c.a4575 - 30 + 1.6 * col, 5.6 * Math.sign(l2));
    const gx = P[0], gz = P[2], gy = .6 + .9 * wr;
    // Deviation from §2.5 (keeps the ≤ 2 tiles/frame check): while rising they also drift over their grid slots, so the
    // 44.03 snap only drops them from the hover height into the lattice.
    const over = ss(40.6, 43.6, tau);
    dx = mixv(dx, gx + .6 * (seed - .5), over); dz = mixv(dz, gz + .6 * (hash01(0xd1f7, k) - .5), over); dy = mixv(dy, gy + 1.2 + rise, over);
    const snap = easeOutCubic((tau - WT.snap) / .25);
    dx = mixv(dx, gx, snap); dz = mixv(dz, gz, snap); dy = mixv(dy, gy, snap);
    const drop = ss(WT.drop + .01 * row, WT.drop + .01 * row + 1.2, tau);
    x = mixv(dx, x, drop); z = mixv(dz, z, drop); y = mixv(dy, y, drop);
  }
  // 6. Hops: kicks (rippling back the line), the anticipation leap held through breath 2.
  if (f.sparkle) for (let i = f.kick; i > f.kick - 6 && i >= 0; i--) {
    const v = hop(tau - .002 * b - w.kicks[i]);
    y += .35 * v; head += .6 * v;
  }
  if (tau >= 17.85 && tau < 18.45) y += .6 * Math.sin(Math.PI / 2 * ss(17.85, 18.05, tau)) * (1 - ss(WT.f2, 18.45, tau));
  // 7. Snare pulse running front to back.
  for (let i = f.snare; i > f.snare - 2 && i >= 0; i--) {const q = (tau - w.snares[i]) * 45 - b; head += 1.5 * Math.exp(-q * q / 8);}
  // 8. Hat sparks.
  let spark = 0;
  if (f.sparkle) for (let i = f.hat; i > f.hat - 4 && i >= 0; i--) {
    const age = tau - w.hats[i];
    if (age < .35 && hash01(k, i) < .12) spark = Math.max(spark, 1 - age / .35);
  }
  out[o] = x; out[o + 1] = y; out[o + 2] = z; out[o + 3] = yaw;
  out[o + 4] = lie; out[o + 5] = stand; out[o + 6] = head; out[o + 7] = spark;
}

/** A single walker's pose at t (no cache): for beams and checks. */
export function walkerPose(w: World, k: number, t: number, out: Float32Array | number[] = new Float32Array(POSE)) {
  pose(w, constsOf(w), frameAt(w, t), k, out, 0);
  return out;
}

let cache: {w: World; t: number; poses: Float32Array} | null = null;
/**
 * All walker poses at t: WALKERS × [x, y, z, yaw, lie, stand, head, spark], single-entry cache keyed by t
 * so both layers of a transition share one evaluation. Treat the result as read-only (it is reused next frame).
 * yaw = atan2(h.x, h.z) of the smoothed route heading; lie 0 stands, 1 lies flat (head toward h); swell is added by the shaders.
 */
export function posesAt(w: World, t: number): Float32Array {
  if (cache && cache.w === w && cache.t === t) return cache.poses;
  const poses = cache?.w === w ? cache.poses : new Float32Array(w.walkers.count * POSE);
  const c = constsOf(w), f = frameAt(w, t);
  for (let k = 0; k < w.walkers.count; k++) pose(w, c, f, k, poses, k * POSE);
  cache = {w, t, poses};
  return poses;
}
