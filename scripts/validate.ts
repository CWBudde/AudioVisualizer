import {readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {assertAnalysis, getAudioControls, SOURCE_HASH} from '../src/controls';
import {sceneAt, sparksAt, tokenPose} from '../src/choreography';
import type {Analysis} from '../src/types';

const a: Analysis = JSON.parse(await readFile('public/analysis/controls.json', 'utf8'));
assertAnalysis(a);
const source = await readFile('public/audio/PixelParade.wav');
assert.equal(createHash('sha256').update(source).digest('hex'), SOURCE_HASH, 'Audio source changed');
const full = JSON.parse(await readFile('analysis/features.json', 'utf8'));
assert.deepEqual(a.cues, full.cues);
assert.deepEqual(a.rhythm, full.rhythm);
for (const [name, track] of Object.entries(a.tracks)) for (const key of ['source', 'energyControl', 'bandControls', 'centroidHz', 'stereoWidth', 'onsets']) {
  assert.deepEqual(track[key as keyof typeof track], full.tracks[name][key], `Export changed ${name}/${key}`);
}
// Each recorded drum event becomes visible at the first frame after its timestamp.
let maximumTimingError = 0;
for (const e of a.tracks.drums.onsets) {
  const frame = Math.ceil(e.timeSeconds * 60), t = frame / 60;
  maximumTimingError = Math.max(maximumTimingError, t - e.timeSeconds);
  assert.ok(getAudioControls(a, t).impact >= e.strength * Math.exp(-(t - e.timeSeconds) / .12) - 1e-9);
}
for (const gap of a.silence) for (let t = gap.startSeconds; t < gap.endSeconds; t += 1 / 60) {
  const c = getAudioControls(a, t);
  assert.equal(c.impact, 0);
  assert.equal(sparksAt(a, t, c, sceneAt(a, c, t)).length, 0);
}
// Pure pose functions must produce identical results after arbitrary seeks.
const times = [0, 8.75, 9.17, 18.05, 18.31, 27.43, 36.6, 44.4, 54.9, 64, 73.14, 82.3, 86.116667];
const poseAt = (t: number) => {const c = getAudioControls(a, t), scene = sceneAt(a, c, t); return {c, scene, tokens: Array.from({length: 80}, (_, id) => tokenPose(a, id, t, c, scene)), sparks: sparksAt(a, t, c, scene)};};
const baseline = times.map(poseAt);
for (const i of [12, 2, 7, 0, 10, 1, 6, 3, 8, 5, 4, 11, 9]) assert.deepEqual(poseAt(times[i]), baseline[i]);
for (let frame = 0; frame < 5168; frame += 3) {
  const t = frame / 60, state = poseAt(t);
  for (const p of state.tokens) {
    assert.ok(Object.values(p).every(Number.isFinite));
    assert.ok(Math.abs(p.x) + p.size < 432 && Math.abs(p.y) + p.size < 432, `Token outside safe area at ${t}`);
  }
  assert.ok(state.sparks.length <= 240);
}
await writeFile('analysis/visual-validation.json', JSON.stringify({sourceSHA256: SOURCE_HASH, totalFrames: 5168, fps: 60, maximumDrumEventDelayMS: maximumTimingError * 1000, eventsChecked: a.tracks.drums.onsets.length, silenceSuppression: 'passed', deterministicSeeks: 'passed', safeAreaAndParticleBounds: 'passed'}, null, 2));
console.log(`Source/schema/export, deterministic poses, safe area and pauses passed. ${a.tracks.drums.onsets.length} drum events within ${(maximumTimingError * 1000).toFixed(2)} ms.`);
