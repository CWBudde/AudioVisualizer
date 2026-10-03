import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {assertAnalysis, getAudioControls, SOURCE_HASH} from '../src/controls';
import {frameUniforms} from '../src/gl/uniforms';
import type {Analysis} from '../src/types';

const a: Analysis = JSON.parse(await readFile('public/analysis/controls.json', 'utf8'));
assertAnalysis(a);
const source = await readFile('public/audio/PixelParade.wav');
assert.equal(createHash('sha256').update(source).digest('hex'), SOURCE_HASH, 'Audio source changed');
const full = JSON.parse(await readFile('analysis/features.json', 'utf8'));
assert.deepEqual(a.cues, full.cues);
assert.deepEqual(a.rhythm, full.rhythm);
for (const [name, track] of Object.entries(a.tracks)) for (const key of ['source', 'energyControl', 'bandControls', 'centroidHz', 'stereoWidth', 'onsets', 'melody']) {
  assert.deepEqual(track[key as keyof typeof track], full.tracks[name][key], `Export changed ${name}/${key}`);
}
// Each recorded drum event becomes visible at the first frame after its timestamp, in its own kind's impulse too.
let maximumTimingError = 0;
for (const e of a.tracks.drums.onsets) {
  const frame = Math.ceil(e.timeSeconds * 60), t = frame / 60, c = getAudioControls(a, t);
  maximumTimingError = Math.max(maximumTimingError, t - e.timeSeconds);
  assert.ok(c.impact >= e.strength * Math.exp(-(t - e.timeSeconds) / .12) - 1e-9);
  assert.ok(c[e.kind as 'kick' | 'snare' | 'hat'] > 0, `No ${e.kind} response at ${t}`);
}
// Each melody note flares at the first frame after its start.
let maximumNoteError = 0;
for (const note of a.tracks.other.melody!.notes) {
  const t = Math.ceil(note.startSeconds * 60) / 60;
  const shown = getAudioControls(a, t).notes.some(n => Math.abs(n.startAge - (t - note.startSeconds)) < 1e-9);
  assert.ok(shown, `Note at ${note.startSeconds} missing from frame ${t * 60}`);
  maximumNoteError = Math.max(maximumNoteError, t - note.startSeconds);
}
// Measured pauses: no drum impulses and no new note flares.
for (const gap of a.silence) for (let t = gap.startSeconds; t < gap.endSeconds; t += 1 / 60) {
  const c = getAudioControls(a, t);
  assert.deepEqual([c.impact, c.kick, c.snare, c.hat], [0, 0, 0, 0], `Impulse inside pause at ${t}`);
  assert.ok(c.notes.every(n => t - n.startAge < gap.startSeconds), `Note starts inside pause at ${t}`);
}
// Frames must be pure functions of time: identical after arbitrary out-of-order seeks.
const times = [0, 8.75, 9.17, 18.05, 18.31, 27.43, 36.6, 44.4, 45.7, 54.9, 62.3, 64, 73.14, 82.3, 86.116667];
const at = (t: number) => frameUniforms(a, t, Math.round(t * 60));
const baseline = times.map(at);
for (const i of [14, 2, 7, 0, 10, 1, 6, 3, 8, 13, 5, 4, 11, 9, 12]) assert.deepEqual(at(times[i]), baseline[i]);
for (let frame = 0; frame < 5168; frame += 3) {
  const u = at(frame / 60);
  for (const [name, value] of Object.entries({...u.scene, ...u.post})) assert.ok(Number.isFinite(value), `${name} not finite at frame ${frame}`);
  assert.ok([...u.notes, ...u.noteHue].every(Number.isFinite), `Note uniforms not finite at frame ${frame}`);
}
await writeFile('analysis/visual-validation.json', JSON.stringify({
  sourceSHA256: SOURCE_HASH, totalFrames: 5168, fps: 60,
  maximumDrumEventDelayMS: maximumTimingError * 1000, maximumNoteDelayMS: maximumNoteError * 1000,
  eventsChecked: a.tracks.drums.onsets.length, notesChecked: a.tracks.other.melody!.notes.length,
  silenceSuppression: 'passed', deterministicSeeks: 'passed', finiteUniforms: 'passed',
}, null, 2) + '\n');
console.log(`Source/schema/export, deterministic seeks, finite uniforms and pauses passed. ${a.tracks.drums.onsets.length} drum events within ${(maximumTimingError * 1000).toFixed(2)} ms, ${a.tracks.other.melody!.notes.length} notes within ${(maximumNoteError * 1000).toFixed(2)} ms.`);
