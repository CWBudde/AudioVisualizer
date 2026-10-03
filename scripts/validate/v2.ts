import assert from 'node:assert/strict';
import type {Analysis} from '../../src/shared/types';
import {frameUniforms} from '../../src/v2/gl/uniforms';
import {FPS, FRAMES} from '../../src/versions';
import {checkSeeks} from './common';

export function validateV2(a: Analysis) {
  const at = (t: number) => frameUniforms(a, t, Math.round(t * FPS));
  checkSeeks(at);
  for (let frame = 0; frame < FRAMES; frame += 3) {
    const u = at(frame / FPS);
    for (const [name, value] of Object.entries({...u.scene, ...u.post})) assert.ok(Number.isFinite(value), `${name} not finite at frame ${frame}`);
    assert.ok([...u.notes, ...u.noteHue].every(Number.isFinite), `Note uniforms not finite at frame ${frame}`);
  }
  return {deterministicSeeks: 'passed', finiteUniforms: 'passed'};
}
