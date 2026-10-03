import type {Analysis} from '../../shared/types';

export type CueName = 'assembly' | 'first-pause' | 'first-parade' | 'second-pause' | 'interlocking-parade' | 'open-breakdown'
  | 'tunnel-return' | 'suspended-breakdown' | 'finale' | 'settle';
/** A point in the song: seconds, a bar/beat on the 105 BPM grid, or a measured cue plus whole bars. */
export type TimeRef = {s: number} | {bar: number; beat?: number} | {cue: CueName; offsetBars?: number};
export type Span = {s: number} | {beats: number} | {bars: number};

export const beatLength = (a: Analysis) => 60 / a.rhythm.bpm;
export const beatTime = (a: Analysis, beat: number) => a.rhythm.beatOriginSeconds + beat * beatLength(a);
/** Start of bar `bar` (0 = first downbeat) plus `beat` beats. */
export const barTime = (a: Analysis, bar: number, beat = 0) => beatTime(a, bar * 4 + a.rhythm.downbeatBeatIndex + beat);
export const songEnd = (a: Analysis) => a.cues[a.cues.length - 1].endSeconds;

export function cueStart(a: Analysis, name: CueName) {
  const cue = a.cues.find(c => c.name === name);
  if (!cue) throw new Error(`Unknown cue ${name}`);
  return cue.startSeconds;
}
export function resolveRef(a: Analysis, r: TimeRef) {
  if ('s' in r) return r.s;
  if ('bar' in r) return barTime(a, r.bar, r.beat ?? 0);
  return cueStart(a, r.cue) + (r.offsetBars ?? 0) * 4 * beatLength(a);
}
export const spanSeconds = (a: Analysis, s: Span) => 's' in s ? s.s : 'beats' in s ? s.beats * beatLength(a) : s.bars * 4 * beatLength(a);
