import {useLayoutEffect} from 'react';
import * as THREE from 'three';
import {PALETTE_GLSL} from '../engine/palette';
import {uniforms, useShader} from './glsl';
import type {WorldFrame} from './types';

/** dim (optional, default 1) multiplies the flash. */
export type LoopRingProps = {world: WorldFrame; dim?: number};

const RING = new THREE.RingGeometry(.5, 1.5, 128, 1).rotateX(-Math.PI / 2);
const vertexShader = `
uniform vec3 uCenter;
uniform float uRadius;
varying float vU;
void main() {
  // Rebuild the annulus at radius R, width .3 (geometry radii .5–1.5 map to R ± .15).
  float r = length(position.xz), u = r - 1.;
  vec2 dir = position.xz / r;
  vU = u * 2.;
  gl_Position = projectionMatrix * viewMatrix * vec4(uCenter + vec3(dir.x, 0., dir.y) * (uRadius + u * .3), 1.);
}`;
const fragmentShader = `
uniform float uGlow;
varying float vU;
${PALETTE_GLSL}
void main() {float u = min(abs(vU), 1.); gl_FragColor = vec4(mix(P_YELLOW, P_AMBER, u) * uGlow * (1. - u * u), 1.);}`;

/** The M4 loop ring (§2.6): an annulus flashing on the ground at T_c, glow 3 · world.ring.flash. */
export const LoopRing = ({world: {ring}, dim = 1}: LoopRingProps) => {
  const material = useShader(() => new THREE.ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: uniforms({uCenter: new THREE.Vector3(), uRadius: 1, uGlow: 0}),
  }));
  useLayoutEffect(() => {
    const u = material.uniforms;
    u.uCenter.value.set(ring.center[0], ring.center[1] + .05, ring.center[2]); u.uRadius.value = ring.radius; u.uGlow.value = 3 * ring.flash * dim;
  }, [material, ring, dim]);
  return ring.flash > .002 && ring.radius > 0 ? <mesh geometry={RING} material={material} frustumCulled={false}/> : null;
};
