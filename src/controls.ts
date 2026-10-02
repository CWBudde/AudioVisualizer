import type {Analysis, AudioControls} from './types';

export const SOURCE_HASH = '20a7f80e5de0e2052071fcba6a838249437d60deb42991b42ed03f1cd955066d';
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
export function assertAnalysis(a: Analysis): void {
  if (a.schemaVersion !== 1 || a.stepSeconds !== .01 || a.tracks?.mix?.source?.sha256 !== SOURCE_HASH) throw new Error('Unsupported or mismatched PixelParade analysis');
  if (Math.abs(a.rhythm.bpm - 105) > .001 || a.tracks.mix.source.durationSeconds !== 86.12) throw new Error('Unexpected source timing');
  const n = Math.ceil(86.12 / a.stepSeconds);
  for (const name of ['mix', 'drums', 'bass', 'other', 'vocals']) {
    const t = a.tracks[name]; if (!t || t.bandControls.length !== 5) throw new Error(`Missing ${name} controls`);
    for (const arr of [t.energyControl, ...t.bandControls, t.centroidHz, t.stereoWidth]) {
      if (arr.length !== n || arr.some(x => !Number.isFinite(x))) throw new Error(`Invalid ${name} timeline`);
    }
    if ([t.energyControl, ...t.bandControls, t.stereoWidth].some(arr => arr.some(x => x < 0 || x > 1))) throw new Error(`Unbounded ${name} controls`);
    let previous = -1;
    for (const e of t.onsets) {
      if (!Number.isFinite(e.timeSeconds) || !Number.isFinite(e.strength) || e.timeSeconds < previous || e.timeSeconds < 0 || e.timeSeconds >= 86.12 || e.strength < 0 || e.strength > 1) throw new Error(`Invalid ${name} event`);
      if (a.silence.some(g => e.timeSeconds >= g.startSeconds && e.timeSeconds < g.endSeconds)) throw new Error(`Event in measured silence: ${name}`);
      previous = e.timeSeconds;
    }
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
  const {mix, drums, bass, other} = a.tracks;
  const step = a.stepSeconds;
  let impact = 0;
  if (!paused) for (const e of drums.onsets) {const age = t - e.timeSeconds; if (age >= 0 && age <= .6) impact = Math.max(impact, e.strength * Math.exp(-age / .12));}
  return {
    bass: sample(bass.bandControls[0], t, step), harmonic: sample(other.bandControls[2], t, step),
    high: Math.max(sample(drums.bandControls[3], t, step), sample(drums.bandControls[4], t, step)),
    energy: sample(mix.energyControl, t, step), spread: lerp(.92, 1.08, clamp(smooth(mix.stereoWidth, t, step) / .12)),
    color: clamp((smooth(other.centroidHz, t, step) - 1500) / 3000), impact,
    beat: (t - a.rhythm.beatOriginSeconds) * a.rhythm.bpm / 60, cue, cueIndex, paused,
  };
}
