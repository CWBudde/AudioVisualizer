import {useLayoutEffect} from 'react';
import * as THREE from 'three';
import type {RGB} from '../engine/palette';
import {PALETTE_GLSL} from '../engine/palette';
import {hash01} from '../engine/random';
import {useWorld} from './context';
import {DEFAULT_FOG, FOG_GLSL, uniforms, useShader} from './glsl';
import {causewaySteps} from './route';
import {cellX, cellZ, TILES} from './tiles';
import type {World, WorldFrame} from './types';

/**
 * floor: brightness of the plain, 0 hides it (drift; the tunnel uses .6); residue: permanent trail level (memory-plain 1.4);
 * fog: exp² fog in linear RGB (default faint void fog); swellGain: 1 lets the bass swell lift tiles; dim: overall multiplier
 * (freeze 1 dims to .4); burn: 0 intact … 1 gone, eaten from Wick outward with an orange rim (the interlocking → drift taper).
 */
export type PlainProps = {t: number; light: number; world: WorldFrame; floor?: number; residue?: number; fog?: {density: number; color: RGB}; swellGain?: number; dim?: number; burn?: number};

const vertexShader = `
attribute vec2 aCell;
attribute vec4 aMeta; // hash, tileArc, tileLateral, crest
attribute vec4 aEvA, aEvB; // up to 8 events: kind · 128 + time, −1 empty, sorted by time
uniform float uT, uLight, uResidue, uGain, uBurn, uPulse, uSwellGain;
uniform vec4 uWick;   // x, z, glow, -
uniform vec4 uAnswer; // x, z, glow (0 when not visible), -
uniform vec2 uShadow; // strength, frontArc
uniform vec3 uSwell;  // center x, z, amp
uniform float uCause[7];
varying vec3 vColor;
${PALETTE_GLSL}
${FOG_GLSL}
void ev(float v, inout float kind, inout float t0) {
  if (v < 0.) return;
  float k = floor(v / 128.), tt = v - k * 128.;
  if (tt <= uT) {kind = k; t0 = tt;}
}
void main() {
  float hash = aMeta.x, arc = aMeta.y, lat = aMeta.z;
  float kind = 0., t0 = -1e3;
  ev(aEvA.x, kind, t0); ev(aEvA.y, kind, t0); ev(aEvA.z, kind, t0); ev(aEvA.w, kind, t0);
  ev(aEvB.x, kind, t0); ev(aEvB.y, kind, t0); ev(aEvB.z, kind, t0); ev(aEvB.w, kind, t0);
  vec3 emis = vec3(0.);
  if (kind > .5) {
    // Cooling: yellow → amber → crimson → purple over 8 s, then a plum residue.
    float x0 = .857, s = 1.;
    if (kind < 2.5 && kind > 1.5) {x0 = .55; s = .6;}
    else if (kind < 3.5 && kind > 2.5) {x0 = 1.; s = .55;}
    else if (kind < 4.5 && kind > 3.5) x0 = .714;
    else if (kind < 5.5 && kind > 4.5) x0 = .429;
    else if (kind < 6.5 && kind > 5.5) {x0 = .714; s = .6;}
    else if (kind < 7.5 && kind > 6.5) {x0 = .714; s = .55;}
    else if (kind > 7.5) x0 = 1.;
    float a = uT - t0;
    float x = a < 8. ? mix(x0, .286, smoothstep(0., 8., a)) : mix(.286, .143, smoothstep(8., 20., a));
    // Wake (3) and crest fill (7) light hundreds of cells at once: a softer flash than the 2.2 of single stamps (WP2-R5).
    float flash = kind > 6.5 && kind < 7.5 ? .35 : kind > 2.5 && kind < 3.5 ? 1.2 : 2.2;
    float I = s * (.10 + .30 * exp(-a / 6.) + flash * exp(-a / .5)) * mix(1., uResidue, smoothstep(6., 10., a));
    emis = lightRamp(x) * I;
    if (a < .1) emis += 1.5 * P_FLARE * exp(-a / .04);
  }
  // Wick's pool of light and the answer's: tight (≈ 0 five tiles out), so the dolly's foreground stays dark (WP2-R5).
  vec2 dw = aCell - uWick.xy, da = aCell - uAnswer.xy;
  emis += P_YELLOW * uWick.z * .3 * exp(-dot(dw, dw) / 1.2) + P_AMBER * uAnswer.z * .3 * exp(-dot(da, da) / 1.5);
  // Swell under the line, causeway stair (orange risers).
  vec2 ds = aCell - uSwell.xy;
  float sw = uSwell.z * uSwellGain * exp(-dot(ds, ds) / 200.), cy = 0.;
  if (arc >= 375. && abs(lat) <= 5.5) for (int j = 0; j < 7; j++) if (arc >= 375. + float(j)) cy += uCause[j];
  emis += lightRamp(.5) * sw * .25 + P_ORANGE * .3 * clamp(cy / .4, 0., 1.);
  // Asleep: void/ink, fading out toward the grid border so the plain never shows an edge.
  float edge = smoothstep(80., 66., max(abs(aCell.x), abs(aCell.y)));
  vec3 col = mix(P_VOID, P_INK, hash) * (.7 + .6 * uLight) * edge + emis;
  // B7 cloud: tiles past the front drop to ×.35, tinted crimson/purple, with a crimson rim on the front.
  float sh = clamp(uShadow.x / .65, 0., 1.) * smoothstep(uShadow.y - 2., uShadow.y + 1., arc), fr = (arc - uShadow.y) / 1.5;
  col = mix(col, col * .35 + mix(P_CRIMSON, P_PURPLE, hash) * .05 * uShadow.x, sh) + P_CRIMSON * .25 * uShadow.x * exp(-fr * fr);
  // Tunnel pulse (48.038): emissive ×(1 + pulse), tinted crimson.
  col = col * (1. + uPulse) + P_CRIMSON * .12 * uPulse;
  // Burn: tiles vanish from Wick outward, the front glowing orange.
  float keep = 1.;
  if (uBurn > 0.) {
    float m = clamp(length(dw) / 45., 0., 1.) * .85 + .15 * hash, b = uBurn * 1.1;
    keep = smoothstep(b - .06, b, m);
    col += P_ORANGE * 10. * keep * (1. - keep);
  }
  vec4 wp = modelMatrix * vec4(aCell.x + position.x * keep, position.y + sw + cy, aCell.y + position.z * keep, 1.);
  vColor = fogged(col * uGain, wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const fragmentShader = `
varying vec3 vColor;
void main() {gl_FragColor = vec4(vColor, 1.);}`;

// Ground beyond (and between) the tiles: void, fogged per fragment, so the plain never ends in a hard edge (WP2-R4).
const groundVertex = `
varying vec3 vWorld;
void main() {vec4 wp = modelMatrix * vec4(position, 1.); vWorld = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp;}`;
const groundFragment = `
uniform float uLight, uGain;
varying vec3 vWorld;
${PALETTE_GLSL}
${FOG_GLSL}
void main() {gl_FragColor = vec4(fogged(P_VOID * (.7 + .6 * uLight) * uGain, vWorld), 1.);}`;
const GROUND = new THREE.PlaneGeometry(1200, 1200).rotateX(-Math.PI / 2).translate(0, -.03, 0);

/** One instanced geometry per World: 160 × 160 static tiles (0.92 quads), shared by every layer, never re-uploaded. */
const geometries = new WeakMap<World, THREE.InstancedBufferGeometry>();
function plainGeometry(w: World) {
  let g = geometries.get(w);
  if (g) return g;
  const n = TILES * TILES, quad = new THREE.PlaneGeometry(.92, .92).rotateX(-Math.PI / 2);
  g = new THREE.InstancedBufferGeometry();
  g.index = quad.index; g.setAttribute('position', quad.getAttribute('position'));
  const cell = new Float32Array(n * 2), meta = new Float32Array(n * 4), {tiles} = w;
  for (let c = 0; c < n; c++) {
    cell[c * 2] = cellX(c); cell[c * 2 + 1] = cellZ(c);
    meta.set([hash01(0x711e, c), tiles.arc[c], tiles.lateral[c], tiles.crest[c]], c * 4);
  }
  g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2));
  g.setAttribute('aMeta', new THREE.InstancedBufferAttribute(meta, 4));
  g.setAttribute('aEvA', new THREE.InstancedBufferAttribute(tiles.events[0], 4));
  g.setAttribute('aEvB', new THREE.InstancedBufferAttribute(tiles.events[1], 4));
  g.instanceCount = n;
  geometries.set(w, g);
  return g;
}

/** The plain (§2.4): a void ground underlay plus one instanced draw of 25,600 tiles; events, cooling, pools, swell, causeway, shadow and burn in the vertex shader. */
export const Plain = ({t, light, world, floor = 1, residue = 1, fog = DEFAULT_FOG, swellGain = 0, dim = 1, burn = 0}: PlainProps) => {
  const w = useWorld(), geometry = plainGeometry(w);
  const material = useShader(() => new THREE.ShaderMaterial({
    vertexShader, fragmentShader,
    uniforms: uniforms({uT: 0, uLight: 0, uResidue: 1, uGain: 1, uBurn: 0, uPulse: 0, uSwellGain: 0, uWick: new THREE.Vector4(), uAnswer: new THREE.Vector4(),
      uShadow: new THREE.Vector2(), uSwell: new THREE.Vector3(), uCause: new Float32Array(7), uFogDensity: 0, uFogColor: new THREE.Color()}),
  }));
  const ground = useShader(() => new THREE.ShaderMaterial({
    vertexShader: groundVertex, fragmentShader: groundFragment, uniforms: uniforms({uLight: 0, uGain: 1, uFogDensity: 0, uFogColor: new THREE.Color()}),
  }));
  useLayoutEffect(() => {
    const g = ground.uniforms;
    g.uLight.value = light; g.uGain.value = floor * dim * (1 - Math.min(1, burn * 1.5)); g.uFogDensity.value = fog.density; g.uFogColor.value.setRGB(...fog.color);
    const u = material.uniforms, {wick, answer, shadow, swell} = world;
    u.uT.value = t; u.uLight.value = light; u.uResidue.value = residue; u.uGain.value = floor * dim; u.uBurn.value = burn;
    u.uPulse.value = shadow.pulse; u.uSwellGain.value = swellGain;
    u.uWick.value.set(wick.p[0], wick.p[2], wick.glow * (.3 + .7 * wick.scale), 0);
    u.uAnswer.value.set(answer.p[0], answer.p[2], answer.glow * answer.visible * answer.stand, 0);
    u.uShadow.value.set(shadow.strength, shadow.frontArc);
    u.uSwell.value.set(swell.center[0], swell.center[2], swell.amp);
    causewaySteps(w, t, u.uCause.value as Float32Array);
    u.uFogDensity.value = fog.density; u.uFogColor.value.setRGB(...fog.color);
  }, [material, ground, w, world, t, light, residue, floor, dim, burn, swellGain, fog]);
  if (floor * dim <= 0) return null;
  return <>
    <mesh geometry={GROUND} material={ground} frustumCulled={false} renderOrder={-.5}/>
    <mesh geometry={geometry} material={material} frustumCulled={false}/>
  </>;
};
