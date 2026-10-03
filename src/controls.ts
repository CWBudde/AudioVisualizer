import type {Analysis, AudioControls, DrumKind, Onset, RecentNote} from './types';

export const SOURCE_HASH = '20a7f80e5de0e2052071fcba6a838249437d60deb42991b42ed03f1cd955066d';
/** Seconds of melody history the renderer can draw. */
export const NOTE_WINDOW = 3;
export const MAX_NOTES = 16;
/** Measured lead range is MIDI 52–91; these bounds map pitch to 0–1. */
export const PITCH_LOW = 50, PITCH_HIGH = 94;
const DECAY: Record<DrumKind, number> = {kick: .12, snare: .16, hat: .06};
// Position of each pitch class on the circle of fifths, so related keys get related hues.
export const FIFTHS = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5].reduce<number[]>((pos, pc, i) => {pos[pc] = i; return pos;}, []);

export const clamp = (x: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ease = (x: number) => {x = clamp(x); return x * x * (3 - 2 * x);};
export const sample = (arr: number[], t: number, step: number) => {
  const position = clamp(t / step, 0, arr.length - 1);
  const i = Math.floor(position);
  return lerp(arr[i], arr[Math.min(i + 1, arr.length - 1)], position - i);
};
const smooth = (arr: number[], t: number, step: number) => {
  // Fixed causal kernel: independent of seek order and render worker history.
  let result = 0, weights = 0;
  for (let i = 0; i <= 15; i++) {const w = Math.exp(-i / 5); result += w * sample(arr, t - i * .01, step); weights += w;}
  return result / weights;
};
/** Number of sorted times at or before t. */
const countUntil = (times: number[], t: number) => {
  let lo = 0, hi = times.length;
  while (lo < hi) {const mid = (lo + hi) >> 1; if (times[mid] <= t) lo = mid + 1; else hi = mid;}
  return lo;
};

// Derived lookups depend only on the analysis object, never on render history.
type Index = {drums: Record<DrumKind, {events: Onset[]; times: number[]}>; noteStarts: number[]};
const indexes = new WeakMap<Analysis, Index>();
function indexOf(a: Analysis): Index {
  let index = indexes.get(a);
  if (!index) {
    const of = (kind: DrumKind) => {const events = a.tracks.drums.onsets.filter(e => e.kind === kind); return {events, times: events.map(e => e.timeSeconds)};};
    index = {drums: {kick: of('kick'), snare: of('snare'), hat: of('hat')}, noteStarts: a.tracks.other.melody!.notes.map(n => n.startSeconds)};
    indexes.set(a, index);
  }
  return index;
}
function impulse(a: Analysis, kind: DrumKind, t: number) {
  const {events, times} = indexOf(a).drums[kind];
  const count = countUntil(times, t);
  let value = 0;
  for (let i = count - 1; i >= 0 && t - events[i].timeSeconds <= .6; i--) value = Math.max(value, events[i].strength * Math.exp(-(t - events[i].timeSeconds) / DECAY[kind]));
  return {value, count, age: count ? t - events[count - 1].timeSeconds : Infinity};
}
export const normalizePitch = (midi: number) => clamp((midi - PITCH_LOW) / (PITCH_HIGH - PITCH_LOW));

export function assertAnalysis(a: Analysis): void {
  if (a.schemaVersion !== 2 || a.stepSeconds !== .01 || a.tracks?.mix?.source?.sha256 !== SOURCE_HASH) throw new Error('Unsupported or mismatched PixelParade analysis');
  if (Math.abs(a.rhythm.bpm - 105) > .001 || a.tracks.mix.source.durationSeconds !== 86.12) throw new Error('Unexpected source timing');
  if (![0, 1, 2, 3].includes(a.rhythm.downbeatBeatIndex)) throw new Error('Missing downbeat');
  const n = Math.ceil(86.12 / a.stepSeconds);
  const inSilence = (t: number) => a.silence.some(g => t >= g.startSeconds && t < g.endSeconds);
  for (const name of ['mix', 'drums', 'bass', 'other', 'vocals']) {
    const t = a.tracks[name]; if (!t || t.bandControls.length !== 5) throw new Error(`Missing ${name} controls`);
    for (const arr of [t.energyControl, ...t.bandControls, t.centroidHz, t.stereoWidth]) {
      if (arr.length !== n || arr.some(x => !Number.isFinite(x))) throw new Error(`Invalid ${name} timeline`);
    }
    if ([t.energyControl, ...t.bandControls, t.stereoWidth].some(arr => arr.some(x => x < 0 || x > 1))) throw new Error(`Unbounded ${name} controls`);
    let previous = -1;
    for (const e of t.onsets) {
      if (!Number.isFinite(e.timeSeconds) || !Number.isFinite(e.strength) || e.timeSeconds < previous || e.timeSeconds < 0 || e.timeSeconds >= 86.12 || e.strength < 0 || e.strength > 1) throw new Error(`Invalid ${name} event`);
      if (inSilence(e.timeSeconds)) throw new Error(`Event in measured silence: ${name}`);
      if (name === 'drums' && !['kick', 'snare', 'hat'].includes(e.kind ?? '')) throw new Error('Unclassified drum event');
      previous = e.timeSeconds;
    }
  }
  const melody = a.tracks.other.melody;
  if (!melody || melody.chroma.length !== 12) throw new Error('Missing melody analysis');
  for (const arr of [melody.pitchMIDI, melody.voicing, ...melody.chroma]) {
    if (arr.length !== n || arr.some(x => !Number.isFinite(x) || x < 0)) throw new Error('Invalid melody timeline');
  }
  if ([melody.voicing, ...melody.chroma].some(arr => arr.some(x => x > 1))) throw new Error('Unbounded melody controls');
  let previous = -1;
  for (const note of melody.notes) {
    if (!(note.startSeconds >= previous && note.startSeconds < note.endSeconds && note.endSeconds <= 86.12)) throw new Error('Invalid melody note timing');
    if (note.midi < PITCH_LOW || note.midi > PITCH_HIGH || !(note.strength > 0 && note.strength <= 1)) throw new Error('Invalid melody note');
    if (inSilence(note.startSeconds)) throw new Error('Melody note starts in measured silence');
    previous = note.startSeconds;
  }
  let end = 0;
  for (const cue of a.cues) {if (Math.abs(cue.startSeconds - end) > .000001 || cue.endSeconds <= cue.startSeconds) throw new Error('Invalid section coverage'); end = cue.endSeconds;}
  if (end !== 86.12) throw new Error('Missing audio tail');
}

export function getAudioControls(a: Analysis, t: number): AudioControls {
  const found = a.cues.findIndex(c => t < c.endSeconds);
  const cueIndex = found < 0 ? a.cues.length - 1 : found;
  const cue = a.cues[cueIndex];
  const paused = a.silence.some(g => t >= g.startSeconds && t < g.endSeconds);
  const {mix, drums, bass, other, vocals} = a.tracks;
  const melody = other.melody!;
  const step = a.stepSeconds;
  const beatLength = 60 / a.rhythm.bpm;
  let impact = 0;
  if (!paused) for (const e of drums.onsets) {const age = t - e.timeSeconds; if (age >= 0 && age <= .6) impact = Math.max(impact, e.strength * Math.exp(-age / .12));}
  const kick = impulse(a, 'kick', t), snare = impulse(a, 'snare', t), hat = impulse(a, 'hat', t);
  // Held pitch: the most recent voiced frame within 2 s, so the melody head never drops to zero between notes.
  let pitch = .5;
  for (let back = 0; back <= 200; back++) {
    const p = melody.pitchMIDI[clamp(Math.round(t / step) - back, 0, melody.pitchMIDI.length - 1)];
    if (p > 0) {pitch = normalizePitch(p); break;}
  }
  // Chroma averaged over one beat, projected onto the circle of fifths.
  let x = 0, y = 0, sum = 0;
  for (let pc = 0; pc < 12; pc++) {
    let v = 0;
    for (let k = 0; k < 12; k++) v += sample(melody.chroma[pc], t - k * beatLength / 12, step) / 12;
    const angle = FIFTHS[pc] / 12 * Math.PI * 2;
    x += v * Math.cos(angle); y += v * Math.sin(angle); sum += v;
  }
  const notes: RecentNote[] = [];
  const starts = indexOf(a).noteStarts;
  for (let i = countUntil(starts, t) - 1; i >= 0 && notes.length < MAX_NOTES; i--) {
    const note = melody.notes[i];
    if (t - note.endSeconds > NOTE_WINDOW) {if (t - note.startSeconds > NOTE_WINDOW + 2) break; continue;}
    notes.unshift({startAge: t - note.startSeconds, endAge: Math.max(0, t - note.endSeconds), pitch: normalizePitch(note.midi), pitchClass: note.midi % 12, strength: note.strength});
  }
  const beat = (t - a.rhythm.beatOriginSeconds) / beatLength;
  const bar = (beat - a.rhythm.downbeatBeatIndex) / 4;
  return {
    bass: sample(bass.bandControls[0], t, step), harmonic: sample(other.bandControls[2], t, step),
    high: Math.max(sample(drums.bandControls[3], t, step), sample(drums.bandControls[4], t, step)),
    energy: sample(mix.energyControl, t, step), spread: lerp(.92, 1.08, clamp(smooth(mix.stereoWidth, t, step) / .12)),
    color: clamp((smooth(other.centroidHz, t, step) - 1500) / 3000), impact,
    kick: paused ? 0 : kick.value, snare: paused ? 0 : snare.value, hat: paused ? 0 : hat.value,
    kickCount: kick.count, snareSteps: snare.count ? snare.count - 1 + ease(snare.age / .18) : 0,
    beat, bar, phrase: bar / 4,
    pitch, voicing: sample(melody.voicing, t, step),
    hue: (Math.atan2(y, x) / (Math.PI * 2) + 1) % 1, tonality: sum > 0 ? Math.hypot(x, y) / sum : 0,
    notes, vocal: sample(vocals.energyControl, t, step),
    cue, cueIndex, paused,
  };
}
