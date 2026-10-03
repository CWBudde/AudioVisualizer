import {useEffect, useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import type {MotifState} from '../engine/frame';
import {RINGS} from '../engine/frame';
import {PALETTE_GLSL} from '../engine/palette';
import {seedOf} from '../engine/random';
import {ANCHOR, CREST} from '../render/shaders/crest.glsl';
import {FULLSCREEN} from '../render/shaders/transition.glsl';
import {fullscreenTriangle} from '../render/targets';
import {Embers} from './Embers';

/** The overlay camera: NDC (x, y) maps to world (x, y) * HALF at z = 0. */
export const MOTIF_CAMERA = {fov: 35, distance: 10};
const HALF = MOTIF_CAMERA.distance * Math.tan(MOTIF_CAMERA.fov / 2 * Math.PI / 180);
/** Crest coordinates of the ember shell's centre (the crest's middle). */
const MIDDLE: [number, number] = [0, .42];

// Wick's crest (§2.3): 12 columns that flare on lead notes, staccato (blinking, narrow, pale flare) → legato (standing,
// wide, amber crown); +40 % caps; a soft halo per column; crest-shaped rings for M4/M5; the 1-px flare dot in freezes 1 and 3.
const fragmentShader = `
precision highp float;
in vec2 vUv;
out vec4 o;
uniform vec2 uCenter;
uniform float uScale, uGlow, uLegato, uWidth, uDot;
uniform float uCols[12];
uniform vec2 uRings[${RINGS}];
${PALETTE_GLSL}
${CREST}
float boxSdf(vec2 p, vec2 b) {vec2 d = abs(p) - b; return length(max(d, 0.)) + min(max(d.x, d.y), 0.);}
void main() {
  vec2 ndc = vUv * 2. - 1., q = (ndc - uCenter) / uScale + ANCHOR;
  float px = max(fwidth(q.x), 1e-5), crest = 1. - uDot;
  vec3 col = vec3(0.);
  float back = 0.;
  if (crest > 0.) {
    float kc = floor((q.x + CREST_HALF) / CREST_COL), base = .55 * uLegato, hw = .5 * uWidth * CREST_COL, cap = max(1.5 * px, .035);
    for (int j = -1; j <= 1; j++) {
      float kf = kc + float(j);
      if (kf < 0. || kf > 11.) continue;
      int k = int(kf);
      float h = CREST_H[k], flare = uCols[k], vis = base + flare;
      if (vis < 1e-3) continue;
      float d = boxSdf(q - vec2(-CREST_HALF + (kf + .5) * CREST_COL, h * .5), vec2(hw, h * .5));
      float fill = smoothstep(.75 * px, -.75 * px, d), top = 1. + .4 * smoothstep(h - cap - px, h - cap, q.y);
      vec3 c = lightRamp(mix(1., .74, uLegato) + .12 * flare) * vis;
      // An ink backing a little wider than each visible column, so the crown reads over a bright crowd too.
      back = max(back, clamp(vis * 2., 0., 1.) * smoothstep(2.5 * px, .5 * px, d));
      col += c * (fill * top + .22 * exp(-max(d, 0.) / .05)) * uGlow;
    }
    for (int i = 0; i < ${RINGS}; i++) {
      vec2 r = uRings[i];
      if (r.x < 0.) continue;
      float R = 1.2 + r.x * 5., rd = crestSdf((q - ANCHOR) / R + ANCHOR) * R;
      col += lightRamp(.74) * exp(-abs(rd) / (.03 * R)) * r.y * exp(-r.x * 1.4) * 1.6;
    }
    col *= crest;
  }
  // The freeze dot: one flare pixel at the crest base.
  vec2 dp = (ndc - (uCenter - ANCHOR * uScale)) / max(fwidth(ndc.x), 1e-6);
  col += P_FLARE * 2.5 * uDot * exp(-dot(dp, dp) / .5);
  // Premultiplied over: the light adds, the backing darkens what lies under the columns (invisible on a dark plain).
  o = vec4(col, .6 * back * crest);
}`;

/** The persistent crest, drawn after the scene blend so it carries continuity across transitions. t is motion time (held through freezes). */
export const MotifLayer = ({state, t, light}: {state: MotifState; t: number; light: number}) => {
  const material = useMemo(() => new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: FULLSCREEN, fragmentShader, transparent: true, depthTest: false, depthWrite: false,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: {uCenter: {value: new THREE.Vector2()}, uScale: {value: 1}, uGlow: {value: 0}, uLegato: {value: 0}, uWidth: {value: .5}, uDot: {value: 0},
      uCols: {value: Array<number>(12).fill(0)}, uRings: {value: Array.from({length: RINGS}, () => new THREE.Vector2(-1, 0))}},
  }), []);
  const geometry = useMemo(fullscreenTriangle, []);
  useEffect(() => () => {material.dispose(); geometry.dispose();}, [material, geometry]);
  useLayoutEffect(() => {
    const u = material.uniforms;
    u.uCenter.value.set(...state.center); u.uScale.value = state.scale; u.uGlow.value = state.glow; u.uLegato.value = state.legato;
    u.uWidth.value = state.width; u.uDot.value = state.dot;
    (u.uCols.value as number[]).splice(0, 12, ...state.columns);
    (u.uRings.value as THREE.Vector2[]).forEach((v, i) => v.set(state.rings[i * 2], state.rings[i * 2 + 1]));
  }, [material, state]);
  const mid = [state.center[0] + (MIDDLE[0] - ANCHOR[0]) * state.scale, state.center[1] + (MIDDLE[1] - ANCHOR[1]) * state.scale];
  return <>
    <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={1}/>
    <group position={[mid[0] * HALF, mid[1] * HALF, 0]}>
      <Embers seed={seedOf('motif')} count={24} t={t} presence={1} mode="gather" radius={state.scale * HALF * .95} light={Math.max(light, state.heat)}
        pulse={state.pulse} morph={state.morph} size={state.scale * HALF * .1} intensity={(.6 + 1.6 * state.growth) * state.embers} speed={.8}/>
    </group>
  </>;
};
