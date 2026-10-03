import {sample} from '../../shared/controls';
import type {Analysis} from '../../shared/types';
import type {Vec3} from '../engine/frame';
import {easeInOutCubic as eioc, easeOutCubic as eoc, envelope, lerp, smoothstep as ss} from '../engine/easing';
import {camArc, heldTime, isFrozen, lastAtOrBefore, wickArc} from './clock';
import {walkerPose} from './poses';
import {causewayY, routeCrisp, routeFrame} from './route';
import type {World, WorldFrame} from './types';

/** The last n times ≤ t, newest first, padded with −1e3. */
function lastN(times: Float64Array, t: number, n: number) {
  const out: number[] = [];
  for (let i = lastAtOrBefore(times, t); out.length < n; i--) out.push(i >= 0 ? times[i] : -1e3);
  return out;
}
const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const mix3 = (a: Vec3, b: Vec3, x: number): Vec3 => [lerp(a[0], b[0], x), lerp(a[1], b[1], x), lerp(a[2], b[2], x)];

const GHOST_STABS = [19.41, 24.03, 28.65];
/** Horizon band windows (§2.6): bars 18–19, 24–25, 36–37. */
const BANDS: [number, number][] = [[41.18, 45.75], [54.9, 59.47], [82.32, 86.12]];
const SHADOW = 29.752, PULSE = 48.038, ANSWER = 60.24, RISE = 64.038;

/** Wick's in-world body (§2.3): crisp route point, note hop, the drift climb, freeze shrink, glow from the note gate. */
function wickAt(w: World, t: number, held: number, arc: number) {
  const k = lastAtOrBefore(w.noteStart, held), start = k >= 0 ? w.noteStart[k] : -1e3;
  const lastEnd = k >= 0 ? Math.max(w.noteEnd[k], k ? w.noteEnd[k - 1] : 0) : -1e3;
  const act = k < 0 ? 0 : held < lastEnd ? 1 : Math.exp(-(held - lastEnd) / .15);
  const hop = k < 0 ? 0 : .25 * Math.sin(Math.PI * Math.min(Math.max((held - start) / .12, 0), 1));
  // Drift only: high notes lift Wick (F#6 at 38.84 → 2.4 tiles), eased over .15 s.
  const lift = (i: number) => i >= 0 ? .15 * Math.max(0, w.noteMidi[i] - 74) : 0;
  const climb = k < 0 ? 0 : lerp(lift(k - 1), lift(k), ss(0, .15, held - start)) * ss(36.6, 36.9, held) * (1 - ss(45, 45.75, t));
  const shrink = Math.max(ss(8.746, 8.813, t) * (1 - ss(9.1685, 9.6185, t)), ss(63.615, 63.682, t) * (1 - ss(RISE, 64.388, t)));
  return {...routeCrisp(arc), y: causewayY(w, arc, t) + hop + climb, scale: 1 - .85 * shrink, glow: .45 + .55 * act, dot: shrink};
}

/** Pedal weight: 1 while a bass D (pitch class 2) sounds, eased at its edges. */
function pedalWeight(w: World, t: number) {
  let v = 0;
  const j0 = lastAtOrBefore(w.bassStart, t + .05);
  for (let j = j0; j >= 0 && j > j0 - 3; j--) {
    if (w.bassMidi[j] % 12 !== 2) continue;
    v = Math.max(v, ss(w.bassStart[j] - .03, w.bassStart[j] + .05, t) * (1 - ss(w.bassEnd[j], w.bassEnd[j] + .15, t)));
  }
  return v;
}

/** Horizon tint: purple .286 on non-G chords, amber .714 on G roots (and from the early C of 82.04 on), .3 s crossfades. */
function horizonTint(w: World, t: number) {
  const tintOf = (i: number) => i < 0 ? .286 : w.chordRoot[i] === 7 || w.chordStart[i] >= 82 ? .714 : .286;
  const i = lastAtOrBefore(w.chordStart, t);
  const chord = i < 0 ? .286 : lerp(tintOf(i - 1), tintOf(i), ss(w.chordStart[i], w.chordStart[i] + .3, t));
  return lerp(chord, .714, ss(82.04, 82.34, t));
}

/**
 * Per-frame world state at song time t (pure; numbers only). Motion reads held time, light reads real t.
 * ghost.glow excludes the (.6 + .4 light) factor (GhostLantern applies it); ring.flash is exp(−age/.5) (LoopRing scales by 3).
 */
export function worldAt(w: World, a: Analysis, t: number): WorldFrame {
  const held = heldTime(t), arc = wickArc(w, t), ca = camArc(w, t), A = (x: number) => wickArc(w, x);
  const wick = wickAt(w, t, held, arc), cam = routeFrame(ca), yCam = causewayY(w, ca, t);
  const bass = sample(a.tracks.bass.bandControls[0], t, a.stepSeconds), vocal = sample(a.tracks.vocals.energyControl, t, a.stepSeconds);

  // Ghost lantern (§2.6): far ahead on the horizon; dives into the tunnel mouth, descends at the stair, then joins Wick.
  const mouth = t < 53 || t >= 57.3 ? 0 : t < 54 ? eioc(t - 53) : 1 - eioc((t - 54) / 3.3);
  const descent = eioc((t - 72.8) / .5);
  const D = lerp(lerp(70, 18, mouth), 28, descent), H = lerp(lerp(5, 2, mouth), 3, descent);
  let ghostP = add(add(add(cam.p, cam.h, D), [0, H + yCam, 0]), cam.r, -4);
  if (t >= 79.8) {
    const side = add(add(wick.p, wick.r, -2.5), [0, causewayY(w, arc, t) + lerp(1.2, .8, ss(84, 84.615, t)), 0]);
    ghostP = mix3(ghostP, side, eioc((t - 79.8) / 1.9));
  }
  let turn = 0;
  for (const c of w.corners) turn = Math.max(turn, ss(c.time - 1.2, c.time - .1, t) * (1 - ss(c.time, c.time + .4, t)));
  let stab = 0;
  for (const s of GHOST_STABS) if (t >= s) stab += Math.exp(-(t - s) / .15);
  const ghost = {p: ghostP, glow: .35 + 2.2 * vocal + 1.6 * stab + turn, radius: 1.2 + 1.8 * mouth};

  // The answer (§2.6): lights at 60.24, walks to Wick's side, then follows it (held through breath 3).
  const A0 = w.answerHome, M = w.answerMeet;
  let ansP = mix3(A0, M, eioc((held - 60.55) / 2.95));
  ansP[1] = held >= 60.55 && held < 63.5 ? .18 * Math.abs(Math.sin(Math.PI * (held - 60.55) / .29)) : 0;
  if (held >= RISE) {
    const fs = routeFrame(arc), side = add(wick.p, fs.r, 1.5);
    side[1] = causewayY(w, arc, t);
    ansP = mix3(ansP, side, eioc((held - RISE) / (64.6 - RISE)));
  }
  const answer = {p: ansP, glow: held >= ANSWER ? 1 + 3 * Math.exp(-(t - ANSWER) / .3) : 0, visible: +(held >= ANSWER), stand: ss(ANSWER, ANSWER + 4 / 60, held)};

  // Herald beams (§2.6 M5): from the right column's front walker, the answer, the F3 lane fronts, and finally the ghost.
  const beams: WorldFrame['beams'] = [];
  w.m5.forEach(({start: T, end}, i) => {
    if (held < T || t > end + .4) return;
    let glow = 0;
    for (let j = lastAtOrBefore(w.noteStart, held); j >= 0 && held - w.noteStart[j] < 1; j--) if (w.noteMotif[j] === 5) glow += Math.exp(-(held - w.noteStart[j]) / .1);
    const g = 1.8 * (.6 + .4 * glow) * (1 - ss(end, end + .4, t)), height = 12 * eoc((held - T) / .12);
    const fromWalker = (k: number): Vec3 => {const q = walkerPose(w, k, t); return [q[0], q[1] + .72 * q[5], q[2]];};
    const sources: Vec3[] = i < 4 ? [fromWalker(1)] : i < 6 ? [[ansP[0], ansP[1] + .9, ansP[2]]] : i === 6 ? [fromWalker(200), fromWalker(208)] : [ghost.p];
    for (const p of sources) beams.push({p, height, glow: g});
  });

  // Loop ring flash at each M4 closing (§2.6): centered where Wick is at T_c.
  let ring = {center: wick.p, radius: 0, flash: 0};
  w.m4.slice(0, 3).forEach(({start}, m) => {
    const Tc = start + 1;
    if (t < Tc || t > Tc + 3) return;
    const ac = A(Tc), c = routeFrame(ac).p;
    ring = {center: [c[0], causewayY(w, ac, t), c[2]], radius: [4, 7, 10][m], flash: Math.exp(-(t - Tc) / .5)};
  });

  // Hammer: the latest M6 hit inside its bar (+ a short tail).
  let hammer = 0;
  for (const {start, hits} of w.m6) {
    if (t < start || t > start + 2.9) continue;
    const i = lastAtOrBefore(hits, t);
    if (i >= 0) hammer = Math.exp(-(t - hits[i]) / .12);
  }

  return {
    held, frozen: +isFrozen(t), arc, camArc: ca,
    wick,
    cam: {...cam, y: yCam},
    pedal: bass * pedalWeight(w, t),
    swell: {center: routeFrame(arc - 10).p, amp: .35 * bass},
    kicks: lastN(w.kicks, held, 6), snares: lastN(w.snares, held, 2), hats: lastN(w.hats, held, 4),
    ghost, answer,
    shadow: {
      strength: .65 * ss(SHADOW, 30.3, t) * (1 - ss(36.6, 37, t)),
      frontArc: A(SHADOW) + 40 - 14 * Math.max(0, t - SHADOW),
      sky: .7 * ss(41.18, 42.3, t) * (1 - ss(44.609, 45.2, t)),
      pulse: t >= PULSE && t < 54.9 ? 2 * Math.exp(-(t - PULSE) / .25) : 0,
    },
    horizon: {glow: Math.max(...BANDS.map(([s, e]) => envelope(t, s, e, .6, 1))), tint: horizonTint(w, t)},
    hammer,
    ring,
    beams,
    sparkle: t < 82.35 ? 1 : 0,
  };
}
