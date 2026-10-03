import {useEffect, useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {PALETTE_GLSL} from '../engine/palette';
import {rngFor} from '../engine/random';
import {GLYPH} from '../render/shaders/glyph.glsl';

export type EmberMode = 'drift' | 'gather' | 'scatter';
/**
 * seed: fixes the cloud; count: instances (fixed per mount); radius: cloud size in world units;
 * presence: 0 scatters and cools them (yellow→red→purple); light: heat on the light ramp; pulse: 0–1 flare.
 * morph: 0 diamond … 1 star glyph; size: sprite size in world units; intensity: HDR gain (blooms above ~1).
 */
export type EmberProps = {
  seed: number; count: number; t: number; presence: number; mode: EmberMode; radius: number; light: number; pulse: number;
  morph?: number; size?: number; intensity?: number; speed?: number;
};
const MODES: Record<EmberMode, number> = {drift: 0, gather: 1, scatter: 2};

const vertexShader = `
attribute vec4 aSeed;
uniform float uT, uPresence, uPulse, uRadius, uSize, uMode, uSpeed;
varying vec2 vUv;
varying float vHeat, vAlpha;
#define TAU 6.2831853
void main() {
  vec4 s = aSeed;
  float z = s.y * 2. - 1., th = s.x * TAU;
  vec3 dir = vec3(sqrt(1. - z * z) * cos(th), z, sqrt(1. - z * z) * sin(th));
  vec3 p;
  vAlpha = 1.;
  float t = uT * uSpeed;
  if (uMode < .5) {
    // Drift: rise through a column and sway, fading at its ends.
    p = dir * uRadius * pow(s.z, .33);
    p.y = mod(p.y + uRadius + t * (.08 + .17 * s.w) * uRadius, 2. * uRadius) - uRadius;
    p.x += sin(t * (.4 + s.w) + s.x * TAU) * .06 * uRadius;
    vAlpha = smoothstep(-uRadius, -.6 * uRadius, p.y) * smoothstep(uRadius, .6 * uRadius, p.y);
  } else if (uMode < 1.5) {
    // Gather: orbit a tilted shell around the origin; the pulse pulls the shell in.
    float a = th + t * (.25 + .5 * s.w) * (s.y > .5 ? 1. : -1.), r = uRadius * (.4 + .6 * s.z) * (1. - .2 * uPulse);
    float tilt = (s.y - .5) * 2.2;
    p = vec3(cos(a) * r, 0., sin(a) * r);
    p.yz = mat2(cos(tilt), -sin(tilt), sin(tilt), cos(tilt)) * p.yz;
    p.y += sin(t * .7 + s.z * TAU) * .05 * uRadius;
  } else {
    // Scatter: stream outward from the origin, each ember on its own looping life.
    float life = fract(s.z + t * (.06 + .12 * s.w) * (1. + .5 * uPulse));
    p = dir * uRadius * (.1 + life);
    vAlpha = smoothstep(0., .1, life) * smoothstep(1., .6, life);
  }
  // Leaving the frame: blow outward.
  float exit = 1. - uPresence;
  p += dir * uRadius * 1.2 * exit * exit;
  vec4 mv = modelViewMatrix * vec4(p, 1.);
  mv.xy += position.xy * uSize * (.45 + .9 * s.w) * (.6 + .4 * uPresence) * (1. + .3 * uPulse);
  gl_Position = projectionMatrix * mv;
  vUv = position.xy * 2.;
  vHeat = s.y;
  vAlpha *= (.65 + .35 * sin(uT * (2. + 4. * s.x) + s.w * TAU)) * smoothstep(0., .2, uPresence);
}`;

const fragmentShader = `
uniform float uMorph, uIntensity, uLight, uPresence, uPulse;
varying vec2 vUv;
varying float vHeat, vAlpha;
${PALETTE_GLSL}
${GLYPH}
void main() {
  float d = glyphSdf(vUv * 1.6, uMorph);
  float glow = (exp(-max(d, 0.) * 10.) * .5 + smoothstep(.02, -.1, d)) * smoothstep(1., .7, length(vUv));
  float heat = clamp((.2 + .8 * uLight) * (.55 + .45 * vHeat) * (.35 + .65 * uPresence) + .2 * uPulse, 0., 1.);
  gl_FragColor = vec4(lightRamp(.2 + .8 * heat) * glow * vAlpha * uIntensity, 1.);
}`;

/** Instanced additive glyph sprites; all motion runs in the vertex shader from uniforms (no per-frame CPU work). */
export const Embers = ({seed, count, t, presence, mode, radius, light, pulse, morph = .5, size = .08, intensity = 2.5, speed = 1}: EmberProps) => {
  const geometry = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry(), quad = new THREE.PlaneGeometry(1, 1);
    g.index = quad.index; g.setAttribute('position', quad.getAttribute('position'));
    const rng = rngFor(seed), seeds = new Float32Array(count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = rng();
    g.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    g.instanceCount = count;
    return g;
  }, [seed, count]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: Object.fromEntries(['uT', 'uPresence', 'uPulse', 'uRadius', 'uSize', 'uMode', 'uSpeed', 'uMorph', 'uIntensity', 'uLight'].map(k => [k, {value: 0}])),
  }), []);
  useEffect(() => () => {geometry.dispose();}, [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    const u = material.uniforms;
    u.uT.value = t; u.uPresence.value = presence; u.uPulse.value = pulse; u.uRadius.value = radius; u.uSize.value = size;
    u.uMode.value = MODES[mode]; u.uSpeed.value = speed; u.uMorph.value = morph; u.uIntensity.value = intensity; u.uLight.value = light;
  }, [material, t, presence, pulse, radius, size, mode, speed, morph, intensity, light]);
  return <mesh geometry={geometry} material={material} frustumCulled={false}/>;
};
