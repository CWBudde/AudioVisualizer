import type {Analysis} from '../../shared/types';
import type {Vec3} from '../engine/frame';
import type {Story} from '../story';
import {camArc, wickArc} from './clock';
import {L, routeFrame, VERTICES} from './route';
import {buildTiles} from './tiles';
import type {Occ, World} from './types';
import {buildWalkers} from './poses';

/** Placeholder until the arcs exist. */
const buildWalkers0 = () => ({count: 0, cohort: new Uint8Array(0), homeArc: new Float32Array(0), homeLat: new Float32Array(0), wake: new Float32Array(0), restLight: new Float32Array(0),
  b1a: new Float32Array(0), b1b: new Float32Array(0), b2: new Float32Array(0), l2: new Float32Array(0), row2: new Uint16Array(0), b3: new Float32Array(0), l3: new Float32Array(0), seed: new Float32Array(0)});

const BAR0 = .038, BAR = 2.285714;
const MOTIF_CODE: Record<string, number> = {M1: 1, M5: 5};
const memo = new WeakMap<Story, WeakMap<Analysis, World>>();

/**
 * The static world, built once per Story (memoized). Never part of FrameState.
 * Lead notes (start/end/vel/midi, crest column, motif tag, arc), drum onsets, corners, m2/m4/m5, m6 (the bass D hits of
 * bars 15 and 23), bass notes, chords, answer home/meet, aRest/aRise/aDrift, the walker table (poses.ts) and the tile tables (tiles.ts).
 */
export function buildWorld(a: Analysis, story: Story): World {
  let byAnalysis = memo.get(story);
  if (!byAnalysis) memo.set(story, byAnalysis = new WeakMap());
  let w = byAnalysis.get(a);
  if (w) return w;
  const notes = story.leadNotes, n = notes.length;
  const firstFinal = notes.findIndex(x => x.startSeconds >= 84.6), final = Math.max(1, firstFinal < 0 ? n - 1 : firstFinal);
  const noteStart = new Float64Array(n), noteEnd = new Float64Array(n), noteVel = new Float32Array(n), noteMidi = new Uint8Array(n);
  const noteCol = new Uint8Array(n), noteMotif = new Uint8Array(n), noteArc = new Float32Array(n);
  notes.forEach((x, i) => {
    noteStart[i] = x.startSeconds; noteEnd[i] = x.endSeconds; noteVel[i] = x.velocity; noteMidi[i] = x.midi;
    const bar = (x.startSeconds - BAR0) / BAR;
    noteCol[i] = Math.min(Math.max(Math.floor(12 * (bar - Math.floor(bar))), 0), 11);
    noteMotif[i] = MOTIF_CODE[x.motif ?? ''] ?? 0;
    noteArc[i] = Math.min(i, final) * L / final;
  });
  const onsets = (kind: string) => Float64Array.from(a.tracks.drums.onsets.filter(o => o.kind === kind).map(o => o.timeSeconds).sort((x, y) => x - y));
  const occ = (id: string): Occ[] => (story.leitmotifs.find(m => m.id === id)?.occurrences ?? []).map(o => ({start: o.startSeconds, end: o.endSeconds}));
  // Corners: interior vertices where the heading changes (370 is a seam), with the note-on that reaches them.
  const corners = VERTICES.slice(1, -1).filter(([arc]) => arc !== 370).map(([arc, x, z]) => ({arc, time: noteStart[Math.min(arc, n - 1)] ?? 0, p: [x, 0, z] as Vec3}));
  const at327 = routeFrame(327), {p, h, r} = at327;
  const bass = story.bassNotes, chords = story.chords;
  // M6 (§2.6 Hammer): the bass D hits (pitch class 2) of bars 15 and 23.
  const m6 = [15, 23].map(bar => {
    const start = BAR0 + bar * BAR;
    return {start, hits: bass.filter(x => x.midi % 12 === 2 && x.startSeconds >= start && x.startSeconds < start + BAR).map(x => x.startSeconds)};
  }).filter(o => o.hits.length);
  w = {
    L, final, noteStart, noteEnd, noteVel, noteMidi, noteCol, noteMotif, noteArc,
    kicks: onsets('kick'), snares: onsets('snare'), hats: onsets('hat'),
    corners, m2: occ('M2'), m4: occ('M4'), m5: occ('M5'), m6,
    walkers: buildWalkers0(), tiles: {size: 160, events: [new Float32Array(0), new Float32Array(0)], arc: new Float32Array(0), lateral: new Float32Array(0), crest: new Uint8Array(0)},
    // Far across the plain, inside the memory-plain dolly frame (WP2-R3; §2.6's h·14 + r·10 lands off-screen).
    answerHome: [Math.round(p[0] - h[0] * 10 + r[0] * 20), 0, Math.round(p[2] - h[2] * 10 + r[2] * 20)],
    answerMeet: [p[0] + r[0] * 1.5, 0, p[2] + r[2] * 1.5],
    aRest: 0, aRise: 0,
    bassStart: Float64Array.from(bass, x => x.startSeconds), bassEnd: Float64Array.from(bass, x => x.endSeconds), bassMidi: Uint8Array.from(bass, x => x.midi),
    chordStart: Float64Array.from(chords, x => x.startSeconds), chordRoot: Uint8Array.from(chords, x => x.root),
    aDrift: 0,
  };
  w.aRest = wickArc(w, 54.9); w.aRise = wickArc(w, 64.038); w.aDrift = camArc(w, 36.6);
  // The walker table needs the arcs; the tiles need the walkers (wake cells).
  w.walkers = buildWalkers(w);
  w.tiles = buildTiles(w);
  byAnalysis.set(a, w);
  return w;
}
