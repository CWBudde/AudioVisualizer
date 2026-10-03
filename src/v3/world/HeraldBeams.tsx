import {useLayoutEffect} from 'react';
import * as THREE from 'three';
import {PALETTE_GLSL} from '../engine/palette';
import {QUAD, uniforms, useShader} from './glsl';
import type {WorldFrame} from './types';

/** dim (optional, default 1) multiplies the beams. */
export type HeraldBeamsProps = {world: WorldFrame; dim?: number};

const MAX = 4;
const vertexShader = `
uniform vec4 uBeam[${MAX}]; // base x, y, z, height
varying vec2 vUv;
varying float vIndex;
void main() {
  int i = int(position.z + .5);
  vec4 b = uBeam[i];
  // Cylindrical billboard: the quad turns about +Y toward the camera, .14 wide.
  vec3 v = cameraPosition - b.xyz, side = normalize(vec3(v.z, 0., -v.x) + 1e-5);
  vec3 p = b.xyz + side * position.x * .14 + vec3(0., (position.y + .5) * b.w, 0.);
  vUv = vec2(position.x * 2., position.y + .5); vIndex = float(i);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
}`;
const fragmentShader = `
uniform float uGlow[${MAX}];
varying vec2 vUv;
varying float vIndex;
${PALETTE_GLSL}
void main() {
  float g = 0.;
  for (int i = 0; i < ${MAX}; i++) if (abs(vIndex - float(i)) < .5) g = uGlow[i];
  float x = min(abs(vUv.x), 1.); // MSAA can extrapolate varyings past the quad (WP4-FYI1)
  // Yellow core, amber edge; fading toward the top.
  vec3 c = mix(P_YELLOW * 1.4, P_AMBER, smoothstep(.1, .8, x)) * (1. - x * x) * mix(1., .25, vUv.y) * smoothstep(1., .85, vUv.y);
  gl_FragColor = vec4(c * g, 1.);
}`;

/** MAX quads in one geometry; position.z carries the beam index. */
const GEOMETRY = (() => {
  const q = QUAD.getAttribute('position'), idx = QUAD.index!, pos: number[] = [], index: number[] = [];
  for (let i = 0; i < MAX; i++) {
    for (let j = 0; j < q.count; j++) pos.push(q.getX(j), q.getY(j), i);
    for (let j = 0; j < idx.count; j++) index.push(idx.getX(j) + i * q.count);
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)).setIndex(index);
})();

/** Herald beams (§2.6 M5): up to 4 cylindrical-billboard additive quads in one draw. */
export const HeraldBeams = ({world: {beams}, dim = 1}: HeraldBeamsProps) => {
  const material = useShader(() => new THREE.ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: uniforms({uBeam: Array.from({length: MAX}, () => new THREE.Vector4()), uGlow: new Float32Array(MAX)}),
  }));
  useLayoutEffect(() => {
    const u = material.uniforms, b = u.uBeam.value as THREE.Vector4[], g = u.uGlow.value as Float32Array;
    for (let i = 0; i < MAX; i++) {
      const x = beams[i];
      if (x) {b[i].set(x.p[0], x.p[1], x.p[2], x.height); g[i] = x.glow * dim;} else {b[i].set(0, -100, 0, 0); g[i] = 0;}
    }
  }, [material, beams, dim]);
  return beams.length ? <mesh geometry={GEOMETRY} material={material} frustumCulled={false}/> : null;
};
