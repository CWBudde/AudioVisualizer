import assert from 'node:assert/strict';
import {getAudioControls} from '../../src/shared/controls';
import type {Analysis} from '../../src/shared/types';
import {sceneAt, sparksAt, tokenPose} from '../../src/v1/choreography';
import {FPS, FRAMES} from '../../src/versions';
import {checkSeeks} from './common';

export function validateV1(a: Analysis) {
  const poseAt = (t: number) => {const c = getAudioControls(a, t), scene = sceneAt(a, c, t); return {c, scene, tokens: Array.from({length: 80}, (_, id) => tokenPose(a, id, t, c, scene)), sparks: sparksAt(a, t, c, scene)};};
  for (const gap of a.silence) for (let t = gap.startSeconds; t < gap.endSeconds; t += 1 / FPS) assert.equal(poseAt(t).sparks.length, 0, `Sparks inside pause at ${t}`);
  checkSeeks(poseAt);
  for (let frame = 0; frame < FRAMES; frame += 3) {
    const t = frame / FPS, state = poseAt(t);
    for (const p of state.tokens) {
      assert.ok(Object.values(p).every(Number.isFinite));
      assert.ok(Math.abs(p.x) + p.size < 432 && Math.abs(p.y) + p.size < 432, `Token outside safe area at ${t}`);
    }
    assert.ok(state.sparks.length <= 240);
  }
  return {deterministicSeeks: 'passed', safeAreaAndParticleBounds: 'passed'};
}
