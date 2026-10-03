import type {Analysis} from '../../shared/types';
import type {Vec3} from '../engine/frame';
import type {Story} from '../story';
import {wickArc} from './clock';
import {L, routeFrame, VERTICES} from './route';
import {buildTiles} from './tiles';
import type {Occ, World} from './types';
import {buildWalkers} from './poses';

const BAR0 = .038, BAR = 2.285714;
const MOTIF_CODE: Record<string, number> = {M1: 1, M5: 5};
const memo = new WeakMap<Story, WeakMap<Analysis, World>>();

/**
 * The static world, built once per Story (memoized). Never part of FrameState.
 * REAL (Phase 0): lead notes (start/end/vel/midi, crest column, motif tag, arc), drum onsets, corners, m2/m4/m5,
 * answer home/meet, aRest/aRise, walker cohort + seed.
 * STUB (Phase 0): m6 is empty (WP1: the 16 bass D hits of §2.6 Hammer); walkers table slots (walkers.ts); tiles (tiles.ts).
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
  w = {
    L, final, noteStart, noteEnd, noteVel, noteMidi, noteCol, noteMotif, noteArc,
    kicks: onsets('kick'), snares: onsets('snare'), hats: onsets('hat'),
    corners, m2: occ('M2'), m4: occ('M4'), m5: occ('M5'), m6: [],
    walkers: buildWalkers(), tiles: buildTiles(),
    answerHome: [Math.round(p[0] + h[0] * 14 + r[0] * 10), 0, Math.round(p[2] + h[2] * 14 + r[2] * 10)],
    answerMeet: [p[0] + r[0] * 1.5, 0, p[2] + r[2] * 1.5],
    aRest: 0, aRise: 0,
  };
  w.aRest = wickArc(w, 54.9); w.aRise = wickArc(w, 64.038);
  byAnalysis.set(a, w);
  return w;
}
