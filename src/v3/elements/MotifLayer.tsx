import {useEffect, useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import type {MotifState} from '../engine/frame';
import {RINGS} from '../engine/frame';
import {PALETTE_GLSL} from '../engine/palette';
import {seedOf} from '../engine/random';
import {GLYPH} from '../render/shaders/glyph.glsl';
import {FULLSCREEN} from '../render/shaders/transition.glsl';
import {fullscreenTriangle} from '../render/targets';
import {Embers} from './Embers';

/** The overlay camera: NDC (x, y) maps to world (x, y) * HALF at z = 0. */
export const MOTIF_CAMERA = {fov: 35, distance: 10};
const HALF = MOTIF_CAMERA.distance * Math.tan(MOTIF_CAMERA.fov / 2 * Math.PI / 180);

// Screen-space glyph: crisp outline, soft halo, hot core, and an expanding glyph-shaped ring per recent flare.
const fragmentShader = `
precision highp float;
in vec2 vUv;
out vec4 o;
uniform vec2 uCenter;
uniform float uScale, uGlow, uMorph, uHeat, uPulse, uT;
uniform vec2 uRings[${RINGS}];
${PALETTE_GLSL}
${GLYPH}
void main() {
  vec2 q = (vUv * 2. - 1. - uCenter) / uScale;
  float a = .08 * uT + .4 * uPulse;
  q = mat2(cos(a), -sin(a), sin(a), cos(a)) * q;
  float d = glyphSdf(q, uMorph), px = max(fwidth(d), 1e-4);
  float outline = exp(-abs(d) / (1.8 * px)), halo = exp(-max(d, 0.) * 2.4), core = exp(-dot(q, q) * 5.);
  vec3 col = lightRamp(.35 + .65 * uHeat) * (outline * .9 + halo * .25 + core * .9 * (.4 + uPulse)) * uGlow;
  for (int i = 0; i < ${RINGS}; i++) {
    vec2 r = uRings[i];
    if (r.x < 0.) continue;
    float R = 1.2 + r.x * 5., rd = glyphSdf(q / R, uMorph) * R;
    col += lightRamp(.55 + .45 * uHeat) * exp(-abs(rd) / (.06 * R)) * r.y * exp(-r.x * 1.4) * 1.6;
  }
  o = vec4(col, 1.);
}`;

/** The persistent recurring element, drawn after the scene blend so it carries continuity across transitions. */
export const MotifLayer = ({state, t, light}: {state: MotifState; t: number; light: number}) => {
  const material = useMemo(() => new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: FULLSCREEN, fragmentShader, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: {uCenter: {value: new THREE.Vector2()}, uScale: {value: 1}, uGlow: {value: 0}, uMorph: {value: 0}, uHeat: {value: 0}, uPulse: {value: 0}, uT: {value: 0},
      uRings: {value: Array.from({length: RINGS}, () => new THREE.Vector2(-1, 0))}},
  }), []);
  const geometry = useMemo(fullscreenTriangle, []);
  useEffect(() => () => {material.dispose(); geometry.dispose();}, [material, geometry]);
  useLayoutEffect(() => {
    const u = material.uniforms;
    u.uCenter.value.set(...state.center); u.uScale.value = state.scale; u.uGlow.value = state.glow; u.uMorph.value = state.morph;
    u.uHeat.value = state.heat; u.uPulse.value = state.pulse; u.uT.value = t;
    (u.uRings.value as THREE.Vector2[]).forEach((v, i) => v.set(state.rings[i * 2], state.rings[i * 2 + 1]));
  }, [material, state, t]);
  return <>
    <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={1}/>
    <group position={[state.center[0] * HALF, state.center[1] * HALF, 0]}>
      <Embers seed={seedOf('motif')} count={90} t={t} presence={1} mode="gather" radius={state.scale * HALF * 3.2} light={Math.max(light, state.heat)}
        pulse={state.pulse} morph={state.morph} size={.05} intensity={.6 + 1.6 * state.growth} speed={.8}/>
    </group>
  </>;
};
