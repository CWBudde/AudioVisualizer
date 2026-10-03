import {SOURCE_HASH} from '../shared/controls';
import type {Analysis} from '../shared/types';
import {pulse} from './engine/easing';
import {barTime, songEnd} from './engine/time';

// Mirror of the Go CompactStory that cmd/story writes to public/analysis/story.json.
export type StoryBar = {index: number; startSeconds: number; endSeconds: number; label: string; section: string; cue: string; chord: string; roles: string[]; motifs: string[]};
export type StorySection = {label: string; startSeconds: number; endSeconds: number; firstBar: number; lastBar: number; cue: string};
export type Occurrence = {startSeconds: number; endSeconds: number; transposition: number; similarity: number; variant: string};
export type Leitmotif = {id: string; role: string; rank: number; prototypeMidi: number[]; occurrences: Occurrence[]};
/** velocity is MIDI 0–127. */
export type StoryNote = {startSeconds: number; endSeconds: number; midi: number; velocity: number; voice: string; motif?: string};
/** root and bass are pitch classes (0 = C). */
export type StoryChord = {startSeconds: number; endSeconds: number; root: number; quality: string; symbol: string; bass: number};
export type StoryKey = {name: string; tonic: number; mode: string; relativeAmbiguous: boolean};
export type Story = {
  schemaVersion: 1; sourceSha256: string; bpm: number; beatOriginSeconds: number; key: StoryKey | null;
  bars: StoryBar[]; sections: StorySection[]; leitmotifs: Leitmotif[]; leadNotes: StoryNote[]; bassNotes: StoryNote[]; chords: StoryChord[];
};
/** One leitmotif at time t: index of its latest occurrence (-1 before the first), seconds since it began (-1 if none), flare 0–1. */
export type MotifAt = {active: boolean; age: number; index: number; pulse: number};
export type StoryAt = {bar: number; barLabel?: string; section?: string; chord?: string; bassMidi?: number; motifs: Record<string, MotifAt>};

/** Seconds a motif flare takes to fall to 1/e. */
export const MOTIF_DECAY = .6;

const fail = (why: string): never => {throw new Error(`Invalid story.json: ${why}`);};
const sortedTimes = (items: {startSeconds: number; endSeconds: number}[], what: string) => {
  let previous = -Infinity;
  for (const x of items) {
    if (!(Number.isFinite(x.startSeconds) && Number.isFinite(x.endSeconds) && x.startSeconds <= x.endSeconds)) fail(`${what} timing`);
    if (x.startSeconds < previous) fail(`${what} not sorted`);
    previous = x.startSeconds;
  }
};
export function assertStory(s: unknown): asserts s is Story {
  const story = s as Story;
  if (story?.schemaVersion !== 1) fail('schemaVersion must be 1');
  if (story.sourceSha256 !== SOURCE_HASH) fail('source hash does not match the soundtrack');
  for (const key of ['bars', 'sections', 'leitmotifs', 'leadNotes', 'bassNotes', 'chords'] as const) if (!Array.isArray(story[key])) fail(`missing ${key}`);
  if (!story.bars.length) fail('no bars');
  sortedTimes(story.bars, 'bars'); sortedTimes(story.sections, 'sections'); sortedTimes(story.bassNotes, 'bass notes'); sortedTimes(story.chords, 'chords');
  for (const m of story.leitmotifs) {
    if (typeof m.id !== 'string' || !Number.isFinite(m.rank) || !Array.isArray(m.occurrences)) fail('leitmotif shape');
    sortedTimes(m.occurrences, `motif ${m.id} occurrences`);
  }
}

const fallbacks = new WeakMap<Analysis, Story>();
/** Beat-grid story for when story.json is absent: bars and cue sections only, no motifs. */
export function storyFromAnalysis(a: Analysis): Story {
  let story = fallbacks.get(a);
  if (story) return story;
  const end = songEnd(a), bars: StoryBar[] = [];
  const cueAt = (t: number) => (a.cues.find(c => t < c.endSeconds) ?? a.cues[a.cues.length - 1]).name;
  for (let i = 0; barTime(a, i) < end - 1e-6; i++) {
    const startSeconds = i ? barTime(a, i) : 0, endSeconds = Math.min(barTime(a, i + 1), end), cue = cueAt(startSeconds);
    bars.push({index: i, startSeconds, endSeconds, label: '', section: cue, cue, chord: '', roles: [], motifs: []});
  }
  const sections = a.cues.map(c => {
    const inside = bars.filter(b => b.startSeconds >= c.startSeconds - 1e-6 && b.startSeconds < c.endSeconds);
    const firstBar = inside[0]?.index ?? bars.filter(b => b.startSeconds <= c.startSeconds).length - 1;
    return {label: c.name, startSeconds: c.startSeconds, endSeconds: c.endSeconds, firstBar, lastBar: inside[inside.length - 1]?.index ?? firstBar, cue: c.name};
  });
  const leadNotes = a.tracks.other.melody!.notes.map(n => ({startSeconds: n.startSeconds, endSeconds: n.endSeconds, midi: n.midi, velocity: Math.round(n.strength * 127), voice: 'lead'}));
  story = {schemaVersion: 1, sourceSha256: SOURCE_HASH, bpm: a.rhythm.bpm, beatOriginSeconds: a.rhythm.beatOriginSeconds, key: null,
    bars, sections, leitmotifs: [], leadNotes, bassNotes: [], chords: []};
  fallbacks.set(a, story);
  return story;
}

/** Number of sorted start times at or before t. */
const countUntil = (times: number[], t: number) => {
  let lo = 0, hi = times.length;
  while (lo < hi) {const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid + 1; else hi = mid;}
  return lo;
};
type Index = {bars: number[]; sections: number[]; bass: number[]; chords: number[]; motifs: {id: string; starts: number[]}[]; occurrences: {id: string; rank: number; startSeconds: number; similarity: number}[]; occurrenceStarts: number[]};
const indexes = new WeakMap<Story, Index>();
function indexOf(s: Story): Index {
  let index = indexes.get(s);
  if (!index) {
    const starts = (xs: {startSeconds: number}[]) => xs.map(x => x.startSeconds);
    const occurrences = s.leitmotifs.flatMap(m => m.occurrences.map(o => ({id: m.id, rank: m.rank, startSeconds: o.startSeconds, similarity: o.similarity})))
      .sort((x, y) => x.startSeconds - y.startSeconds || x.rank - y.rank);
    index = {bars: starts(s.bars), sections: starts(s.sections), bass: starts(s.bassNotes), chords: starts(s.chords),
      motifs: s.leitmotifs.map(m => ({id: m.id, starts: starts(m.occurrences)})), occurrences, occurrenceStarts: starts(occurrences)};
    indexes.set(s, index);
  }
  return index;
}
/** The active item whose [start, end) contains t, if any. */
const activeAt = <T extends {startSeconds: number; endSeconds: number}>(items: T[], starts: number[], t: number) => {
  const item = items[countUntil(starts, t) - 1];
  return item && t < item.endSeconds ? item : undefined;
};

export function storyAt(s: Story, t: number): StoryAt {
  const index = indexOf(s);
  const bar = s.bars[Math.max(0, countUntil(index.bars, t) - 1)];
  const section = s.sections[countUntil(index.sections, t) - 1];
  const chord = activeAt(s.chords, index.chords, t), bass = activeAt(s.bassNotes, index.bass, t);
  const motifs: Record<string, MotifAt> = {};
  s.leitmotifs.forEach((m, i) => {
    const k = countUntil(index.motifs[i].starts, t) - 1, o = m.occurrences[k];
    motifs[m.id] = o ? {active: t < o.endSeconds, age: t - o.startSeconds, index: k, pulse: pulse(t - o.startSeconds, MOTIF_DECAY)} : {active: false, age: -1, index: -1, pulse: 0};
  });
  const at: StoryAt = {bar: bar.index, motifs};
  if (bar.label) at.barLabel = bar.label;
  if (section) at.section = section.label;
  if (chord) at.chord = chord.symbol;
  if (bass) at.bassMidi = bass.midi;
  return at;
}
/** The latest `n` motif occurrences (any motif) that began within `window` seconds before t, newest first. */
export function recentOccurrences(s: Story, t: number, n: number, window: number) {
  const {occurrences, occurrenceStarts} = indexOf(s), out: {id: string; rank: number; age: number; similarity: number}[] = [];
  for (let i = countUntil(occurrenceStarts, t) - 1; i >= 0 && out.length < n && t - occurrences[i].startSeconds <= window; i--) {
    const o = occurrences[i]; out.push({id: o.id, rank: o.rank, age: t - o.startSeconds, similarity: o.similarity});
  }
  return out;
}
/** Occurrences of all motifs that began at or before t, and in total. */
export function occurrenceProgress(s: Story, t: number) {
  const {occurrenceStarts} = indexOf(s);
  return {seen: countUntil(occurrenceStarts, t), total: occurrenceStarts.length};
}
