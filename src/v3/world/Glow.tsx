import {useLayoutEffect} from 'react';
import * as THREE from 'three';
import type {RGB} from '../engine/palette';
import type {Vec3} from '../engine/frame';
import {QUAD, uniforms, useShader} from './glsl';

const vertexShader = `
uniform vec3 uCenter;
uniform float uRadius;
varying vec2 vUv;
void main() {
  vec4 mv = viewMatrix * vec4(uCenter, 1.);
  mv.xy += position.xy * 2. * uRadius;
  vUv = position.xy * 2.;
  gl_Position = projectionMatrix * mv;
}`;
const fragmentShader = `
uniform vec3 uColor;
uniform float uCore;
varying vec2 vUv;
void main() {
  float r2 = dot(vUv, vUv);
  // A hot core inside a soft halo, zero at the quad edge.
  float g = (exp(-r2 * 5.) + uCore * exp(-r2 * 60.)) * smoothstep(1., .6, sqrt(r2));
  gl_FragColor = vec4(uColor * g, 1.);
}`;

/** An additive camera-facing orb (one draw): color is linear HDR; core adds a tight hot center. Not fogged. */
export const Glow = ({position, radius, color, core = 1}: {position: Vec3; radius: number; color: RGB; core?: number}) => {
  const material = useShader(() => new THREE.ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: uniforms({uCenter: new THREE.Vector3(), uRadius: 1, uColor: new THREE.Color(), uCore: 1}),
  }));
  useLayoutEffect(() => {
    const u = material.uniforms;
    u.uCenter.value.set(...position); u.uRadius.value = radius; u.uColor.value.setRGB(...color); u.uCore.value = core;
  }, [material, position, radius, color, core]);
  return <mesh geometry={QUAD} material={material} frustumCulled={false} renderOrder={3}/>;
};
