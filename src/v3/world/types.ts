import type {Vec3} from '../engine/frame';

// The shared world contracts of docs/v3/script.md §6.1. Owned by WP1; change only with all packages in mind.

export type Frame3 = {p: Vec3; h: Vec3; r: Vec3};
export type Occ = {start: number; end: number};
export type WalkerTable = {
  count: number;                                   // 2048
  cohort: Uint8Array;                              // 0 trail, 1 guard, 2 plain
  homeArc: Float32Array; homeLat: Float32Array; wake: Float32Array; restLight: Float32Array;
  b1a: Float32Array; b1b: Float32Array;            // F1 back distance at 9.1685 and at 11.467 (cohort 0)
  b2: Float32Array; l2: Float32Array; row2: Uint16Array;
  b3: Float32Array; l3: Float32Array;
  seed: Float32Array;                              // hash01 per walker
};
/** Static, built once per Story by buildWorld (memoized in a WeakMap). Never part of FrameState. */
export type World = {
  L: number; final: number;
  noteStart: Float64Array; noteEnd: Float64Array; noteVel: Float32Array; noteMidi: Uint8Array;
  noteCol: Uint8Array; noteMotif: Uint8Array;      // motif: 0 none, 1 M1, 5 M5
  noteArc: Float32Array;
  kicks: Float64Array; snares: Float64Array; hats: Float64Array;
  corners: {arc: number; time: number; p: Vec3}[];
  m2: Occ[]; m4: Occ[]; m5: Occ[]; m6: {start: number; hits: number[]}[];
  walkers: WalkerTable;
  tiles: {size: 160; events: [Float32Array, Float32Array]; arc: Float32Array; lateral: Float32Array; crest: Uint8Array};
  answerHome: Vec3; answerMeet: Vec3;
  aRest: number; aRise: number;                    // A(54.9), A(64.038); Δ = aRise − aRest
  // Additions by WP1 (briefing item 6): bass notes and chords (pedal, horizon tint), the drift orbit's start arc.
  bassStart: Float64Array; bassEnd: Float64Array; bassMidi: Uint8Array;
  chordStart: Float64Array; chordRoot: Uint8Array; // root pitch class (7 = G)
  aDrift: number;                                  // camArc(36.6): Drift's orbit starts from routeFrame(aDrift)
};
/** Per-frame world state: numbers only (validation walks it with assertFinite). */
export type WorldFrame = {
  held: number; frozen: number;                    // heldTime(t); 1 inside a freeze
  arc: number; camArc: number;
  wick: Frame3 & {y: number; scale: number; glow: number; dot: number};
  cam: Frame3 & {y: number};                       // routeFrame(camArc), y = causewayY
  pedal: number;
  swell: {center: Vec3; amp: number};
  kicks: number[]; snares: number[]; hats: number[]; // last 6 / 2 / 4 onset times ≤ held (−1e3 when none)
  ghost: {p: Vec3; glow: number; radius: number};
  answer: {p: Vec3; glow: number; visible: number; stand: number};
  shadow: {strength: number; frontArc: number; sky: number; pulse: number};
  horizon: {glow: number; tint: number};
  hammer: number;                                  // exp(−age/.12) of the latest M6 hit inside an M6 bar
  ring: {center: Vec3; radius: number; flash: number};
  beams: {p: Vec3; height: number; glow: number}[]; // 0–2 active
  sparkle: number;                                 // 1, then 0 from 82.35 (hats, embers, hops off)
};
export type WalkerLook = 'walker' | 'ember';
export type Rig = {back: number; side: number; up: number; ahead: number; lift: number; fov: number; roll?: number};
