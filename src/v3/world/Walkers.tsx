import {useEffect, useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {PALETTE_GLSL} from '../engine/palette';
import {GLYPH} from '../render/shaders/glyph.glsl';
import {useWorld} from './context';
import type {Fog} from './glsl';
import {DEFAULT_FOG, FOG_GLSL, QUAD, uniforms, useShader} from './glsl';
import {POSE, posesAt, WALKERS} from './poses';
import type {WalkerLook, WorldFrame} from './types';

/**
 * look 'ember' draws heads only as glyph sprites (drift); max caps drawn instances (200 before 54.9, 2048 after).
 * Optional: dim multiplies everything emitted; fog as on the plain (default the plain's); swellGain 1 rides the bass swell like the tiles;
 * near [a, b]: walkers closer than b tiles to the layer's camera shrink (and dim) so they look no bigger than at b, and are
 * gone by a, so a low rig never looks through a wall of blocks at the lens (WP2-R6). The default only keeps them off the near plane.
 */
export type WalkersProps = {t: number; world: WorldFrame; look?: WalkerLook; max?: number; light: number; dim?: number; fog?: Fog; swellGain?: number; near?: [number, number]};
const NEAR: [number, number] = [1.5, 3.5];

// Pose attributes straight from posesAt: aP0 = x, y, z, yaw; aP1 = lie, stand, head, spark.
const POSE_GLSL = `
attribute vec4 aP0, aP1;
uniform vec3 uSwell;
uniform vec2 uNear;
uniform float uLight, uDim;
vec3 swelled(vec3 p) {vec2 d = p.xz - uSwell.xy; p.y += uSwell.z * exp(-dot(d, d) / 200.); return p;}
// Closer than uNear.y to the lens a walker shrinks with the distance, so it never looks bigger on screen than one at
// uNear.y (a dim mark, not a block); by uNear.x it is gone. Per layer: cameraPosition is this layer's camera.
float nearFade(vec3 p) {
  float d = distance(p + vec3(0., .36, 0.), cameraPosition);
  return smoothstep(uNear.x, uNear.x + 1.5, d) * clamp(d / uNear.y, 0., 1.);
}`;

const bodyVertex = `
attribute float aPart, aSeed;
varying vec3 vColor;
${POSE_GLSL}
${PALETTE_GLSL}
${FOG_GLSL}
void main() {
  float lie = aP1.x, stand = aP1.y, head = aP1.z;
  vec3 h = vec3(sin(aP0.w), 0., cos(aP0.w)), r = vec3(-h.z, 0., h.x);
  // Lie: rotate about r so the head falls forward (toward h), lifted so the bar rests on the ground.
  float th = lie * 1.5707963, c = cos(th), s = sin(th);
  vec3 base = swelled(aP0.xyz);
  float nf = nearFade(base), k = stand * nf;
  vec3 q = position * k;
  // A lying walker is a low mark on the plain (half a voxel thick), not a block in a low camera's sight line.
  float rest = clamp(lie, 0., 1.);
  q = vec3(q.x, (q.y * c - q.z * s + .18 * s * k) * (1. - .5 * rest), q.y * s + q.z * c);
  vec3 wp = base + r * q.x + vec3(0., q.y, 0.) + h * q.z;
  // Faces lit by their local normal (top full, sides darker) so close walkers read as blocks, not flat cards.
  float face = .55 + .45 * max(normal.y, 0.) + .15 * abs(normal.x);
  vec3 col = aPart > .5
    ? head * lightRamp(.62 + .15 * uLight + .08 * min(head, 1.)) * 1.2 * face * (1. - .4 * rest)
    : lightRamp(mix(.429, .286, aSeed)) * .2 * face * (1. - .6 * rest);
  // Resting walkers are cooled marks, not lamps: the lying foot sinks toward the ink, the head glows low.
  vColor = fogged(col * uDim * (.4 + .6 * nf) * step(1e-4, nf), wp);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}`;
const colorFragment = `
varying vec3 vColor;
void main() {gl_FragColor = vec4(vColor, 1.);}`;

// Hat sparks: a tiny flare rising 1.5 above the head over .35 s.
const sparkVertex = `
varying vec2 vUv;
varying float vSpark;
${POSE_GLSL}
void main() {
  float spark = aP1.w * aP1.y * nearFade(swelled(aP0.xyz));
  vec3 p = swelled(aP0.xyz) + vec3(0., .9 + 1.5 * (1. - spark), 0.);
  vec4 mv = viewMatrix * vec4(p, 1.);
  mv.xy += position.xy * .16 * step(.001, spark);
  vUv = position.xy * 2.; vSpark = spark;
  gl_Position = projectionMatrix * mv;
}`;
const sparkFragment = `
varying vec2 vUv;
varying float vSpark;
uniform float uDim;
${PALETTE_GLSL}
void main() {gl_FragColor = vec4(P_FLARE * 3. * vSpark * uDim * exp(-dot(vUv, vUv) * 4.), 1.);}`;

// Ember look (drift): the head only, a glyph sprite cooling crimson → orange with the light.
const emberVertex = `
varying vec2 vUv;
varying float vHead;
${POSE_GLSL}
void main() {
  vec3 p = swelled(aP0.xyz) + vec3(0., .54 * aP1.y, 0.);
  float nf = nearFade(swelled(aP0.xyz));
  vec4 mv = viewMatrix * vec4(p, 1.);
  mv.xy += position.xy * .7 * aP1.y * nf;
  vUv = position.xy * 2.; vHead = aP1.z * nf;
  gl_Position = projectionMatrix * mv;
}`;
const emberFragment = `
varying vec2 vUv;
varying float vHead;
uniform float uLight, uDim;
${PALETTE_GLSL}
${GLYPH}
void main() {
  float d = glyphSdf(vUv * 1.7, .5);
  float g = exp(-max(d, 0.) * 9.) * .45 + smoothstep(.03, -.08, d);
  gl_FragColor = vec4(lightRamp(.42 + .3 * uLight + .05 * vHead) * g * (.5 + .9 * vHead) * uDim * smoothstep(1., .7, length(vUv)), 1.);
}`;

/** Two stacked .36 cubes (foot, head) with a per-vertex part flag: 24 triangles. */
function walkerBody() {
  const box = new THREE.BoxGeometry(.36, .36, .36).toNonIndexed(), pos = box.getAttribute('position'), nor = box.getAttribute('normal'), m = pos.count;
  const p = new Float32Array(m * 6), nn = new Float32Array(m * 6), part = new Float32Array(m * 2);
  for (let i = 0; i < 2 * m; i++) {
    const j = i % m;
    p.set([pos.getX(j), pos.getY(j) + (i < m ? .18 : .54), pos.getZ(j)], i * 3);
    nn.set([nor.getX(j), nor.getY(j), nor.getZ(j)], i * 3);
    part[i] = i < m ? 0 : 1;
  }
  box.dispose();
  return {position: new THREE.BufferAttribute(p, 3), normal: new THREE.BufferAttribute(nn, 3), part: new THREE.BufferAttribute(part, 1)};
}

/** Walkers (§2.5): one instanced draw (bodies or ember sprites) plus one for hat sparks, fed by posesAt in a layout effect. */
export const Walkers = ({t, world, look = 'walker', max = WALKERS, light, dim = 1, fog = DEFAULT_FOG, swellGain = 0, near = NEAR}: WalkersProps) => {
  const w = useWorld();
  const {buffer, body, sprites, sparks} = useMemo(() => {
    const buffer = new THREE.InstancedInterleavedBuffer(new Float32Array(w.walkers.count * POSE), POSE).setUsage(THREE.DynamicDrawUsage);
    const withPose = (g: THREE.InstancedBufferGeometry) => {
      g.setAttribute('aP0', new THREE.InterleavedBufferAttribute(buffer, 4, 0));
      g.setAttribute('aP1', new THREE.InterleavedBufferAttribute(buffer, 4, 4));
      return g;
    };
    const parts = walkerBody(), body = withPose(new THREE.InstancedBufferGeometry());
    body.setAttribute('position', parts.position); body.setAttribute('normal', parts.normal); body.setAttribute('aPart', parts.part);
    body.setAttribute('aSeed', new THREE.InstancedBufferAttribute(w.walkers.seed, 1));
    const quad = () => {const g = withPose(new THREE.InstancedBufferGeometry()); g.index = QUAD.index; g.setAttribute('position', QUAD.getAttribute('position')); return g;};
    return {buffer, body, sprites: quad(), sparks: quad()};
  }, [w]);
  useEffect(() => () => {body.dispose(); sprites.dispose(); sparks.dispose();}, [body, sprites, sparks]);
  const u0 = () => uniforms({uSwell: new THREE.Vector3(), uNear: new THREE.Vector2(...NEAR), uLight: 0, uDim: 1, uFogDensity: 0, uFogColor: new THREE.Color()});
  const bodyMaterial = useShader(() => new THREE.ShaderMaterial({vertexShader: bodyVertex, fragmentShader: colorFragment, uniforms: u0()}));
  const additive = {transparent: true, depthWrite: false, blending: THREE.AdditiveBlending} as const;
  const emberMaterial = useShader(() => new THREE.ShaderMaterial({vertexShader: emberVertex, fragmentShader: emberFragment, uniforms: u0(), ...additive}));
  const sparkMaterial = useShader(() => new THREE.ShaderMaterial({vertexShader: sparkVertex, fragmentShader: sparkFragment, uniforms: u0(), ...additive}));
  useLayoutEffect(() => {
    (buffer.array as Float32Array).set(posesAt(w, t)); buffer.needsUpdate = true;
    const n = Math.min(max, w.walkers.count);
    body.instanceCount = sprites.instanceCount = sparks.instanceCount = n;
    for (const m of [bodyMaterial, emberMaterial, sparkMaterial]) {
      const u = m.uniforms;
      u.uSwell.value.set(world.swell.center[0], world.swell.center[2], world.swell.amp * swellGain);
      u.uLight.value = light; u.uDim.value = dim; u.uNear.value.set(near[0], near[1]); u.uFogDensity.value = fog.density; u.uFogColor.value.setRGB(...fog.color);
    }
  }, [w, buffer, body, sprites, sparks, bodyMaterial, emberMaterial, sparkMaterial, t, world, max, light, dim, fog, swellGain, near[0], near[1]]);
  return <>
    {look === 'ember'
      ? <mesh geometry={sprites} material={emberMaterial} frustumCulled={false}/>
      : <mesh geometry={body} material={bodyMaterial} frustumCulled={false}/>}
    <mesh geometry={sparks} material={sparkMaterial} frustumCulled={false} renderOrder={2}/>
  </>;
};
