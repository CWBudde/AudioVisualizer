import {FIFTHS, MAX_NOTES, getAudioControls} from '../controls';
import {shotAt} from '../director';
import type {Shot} from '../director';
import type {Analysis, AudioControls} from '../types';

/** Mean chroma hue of the track; harmony shifts the palette relative to this home. */
const HOME_HUE = .235;

export type FrameUniforms = {
  controls: AudioControls; shot: Shot;
  scene: Record<string, number>; notes: Float32Array; noteHue: Float32Array; noteCount: number;
  post: Record<string, number>;
};

/** Everything one frame needs, as a pure function of time. */
export function frameUniforms(a: Analysis, t: number, frame: number): FrameUniforms {
  const c = getAudioControls(a, t), s = shotAt(a, c, t);
  const notes = new Float32Array(MAX_NOTES * 4), noteHue = new Float32Array(MAX_NOTES);
  c.notes.forEach((n, i) => {
    notes.set([n.startAge, n.endAge, n.pitch, n.strength], i * 4);
    // Diatonic notes sit next to each other on the circle of fifths, so they spread across the palette.
    noteHue[i] = FIFTHS[n.pitchClass] / 7;
  });
  const drift = ((c.hue - HOME_HUE + 1.5) % 1) - .5;
  return {
    controls: c, shot: s, notes, noteHue, noteCount: c.notes.length,
    scene: {
      uTime: t, uBeat: c.beat, uBar: c.bar,
      uVoid: s.void, uTunnel: s.tunnel, uKaleido: s.kaleido, uAurora: s.aurora, uFragments: s.fragments,
      uZoom: s.zoom, uRoll: s.roll, uTravel: s.travel, uFolds: s.folds, uFoldSpin: s.foldSpin, uDiamond: s.diamond,
      uAccent: s.accent, uCollapse: s.collapse, uRibbon: s.ribbon, uRibbonFold: s.ribbonFold, uHueOff: drift * c.tonality * .6,
      uKick: c.kick, uSnare: c.snare, uHat: c.hat, uBass: c.bass, uHarm: c.harmonic, uEnergy: c.energy, uVocal: c.vocal,
      uPitch: c.pitch, uVoicing: c.voicing,
    },
    post: {uBloomAmount: s.bloom, uAberration: s.aberration, uSaturation: s.saturation, uBrightness: s.brightness, uGrain: s.grain, uFrame: frame},
  };
}
