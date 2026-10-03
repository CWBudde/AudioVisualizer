import {useEffect, useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {Backdrop} from '../elements/Backdrop';
import {smoothstep} from '../engine/easing';
import type {CameraPose, SceneProps} from '../engine/frame';
import {mixRGB, PALETTE_GLSL, scaleRGB, tone} from '../engine/palette';
import type {RGB} from '../engine/palette';
import {hash01} from '../engine/random';
import {followRig, RIGS, routeFrame, useWorld} from '../world';
import type {WorldFrame} from '../world';
import {lastAtOrBefore} from '../world/clock';
import {GhostLantern} from '../world/GhostLantern';
import {HeraldBeams} from '../world/HeraldBeams';
import {Plain} from '../world/Plain';
import {Walkers} from '../world/Walkers';
import {Wick} from '../world/Wick';
import type {SceneDef} from './registry';

// tunnel (§4.5): the plain comes back as raised tile walls along the route; the march resumes, darker. Owned by WP4.
// Walls rise with the bass slide (45.5–46.32), pulse crimson on B7 (48.038), flicker with the kicks of bar 22,
// hammer on the M6 hits of bar 23, frame the ghost in the mouth at 54.0, then part and sink under the dissolve.

const ARC0 = 200, ARC1 = 312, HALF = 6, ROWS = 4, PART = 8;
/** Shared by the plain and the walls: far tiles sink into a plum dark instead of black. */
const FOG = {density: .032, color: scaleRGB(mixRGB(tone('ink'), tone('plum'), .35), .7) as RGB};

/**
 * Wall cells: tile columns where the distance to the smoothed route (arcs 200–312) is ≈ HALF, plus the bisector between
 * two legs that run closer than 2·HALF (240–274 is a U only 10 wide). A plain ±6 offset of routeFrame would fold at
 * the inner corners and wall off the neighbouring leg; the distance field gives one clean corridor, open at both ends.
 * Per cell: x, z, arc of the nearest route point, outward direction (for the part), hash. Built once.
 */
function buildWalls() {
  const step = .25, s0 = ARC0 - 10, n = Math.round((ARC1 + 10 - s0) / step) + 1;
  const sx = new Float64Array(n), sz = new Float64Array(n), sa = new Float64Array(n);
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const s = s0 + i * step, {p} = routeFrame(s);
    sx[i] = p[0]; sz[i] = p[2]; sa[i] = s;
    x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]);
  }
  const cells: number[] = [];
  for (let X = Math.floor(x0) - HALF - 2; X <= Math.ceil(x1) + HALF + 2; X++) for (let Z = Math.floor(z0) - HALF - 2; Z <= Math.ceil(z1) + HALF + 2; Z++) {
    let d = Infinity, k = 0;
    for (let i = 0; i < n; i++) {const dd = (X - sx[i]) ** 2 + (Z - sz[i]) ** 2; if (dd < d) {d = dd; k = i;}}
    d = Math.sqrt(d);
    const a = sa[k];
    // Nearest point at the sampled ends: an end cap. Leave both ends open.
    if (a < ARC0 || a > ARC1 || d >= HALF + .6 || d < 3.5) continue;
    let d2 = Infinity;
    for (let i = 0; i < n; i++) if (Math.abs(sa[i] - a) > 14) d2 = Math.min(d2, (X - sx[i]) ** 2 + (Z - sz[i]) ** 2);
    if (d < HALF - .5 && Math.sqrt(d2) - d >= 1) continue;
    cells.push(X, Z, a, (X - sx[k]) / d, (Z - sz[k]) / d, hash01(0x7a11, X * 1009 + Z));
  }
  return cells;
}

const vertexShader = `
attribute vec4 aWall;   // cell x, cell z, arc, row
attribute vec4 aOut;    // outward x, z, hash
uniform float uT, uA, uPart, uSink;
varying vec3 vPos, vNormal;
varying vec2 vUv;
varying float vArc, vHash, vRow;
void main() {
  // Extrude out of the floor with the bass slide, near Wick first; part outward and sink at the end.
  float rise = smoothstep(45.5 + .002 * (aWall.z - uA), 46.32, uT);
  vec2 xz = aWall.xy + aOut.xy * ${PART.toFixed(1)} * uPart;
  float y = aWall.w + .5 - ${ROWS.toFixed(1)} * (1. - rise) - ${(ROWS + .2).toFixed(1)} * uSink;
  vPos = position * .92 + vec3(xz.x, y, xz.y);
  vNormal = normal; vUv = uv; vArc = aWall.z; vHash = aOut.z; vRow = aWall.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(vPos, 1.);
}`;

const fragmentShader = `
uniform vec3 uWick, uFogColor;
uniform float uWickGlow, uLight, uBar22, uKick, uStep, uKickN, uHammer, uHitN, uPulse, uA, uFogDensity;
varying vec3 vPos, vNormal;
varying vec2 vUv;
varying float vArc, vHash, vRow;
${PALETTE_GLSL}
void main() {
  if (vPos.y < 0.) discard; // still under the floor
  // MSAA shades edge pixels at the pixel centre, extrapolating vUv past the face: clamp, or edge-on faces explode.
  vec2 e = clamp(min(vUv, 1. - vUv), 0., .5);
  float edge = min(e.x, e.y), rim = exp(-edge / .03);
  vec3 toW = uWick - vPos;
  float d2 = dot(toW, toW), facing = max(dot(vNormal, toW * inversesqrt(d2)), 0.);
  // The wall's crown: the top face of the top row carries the brightest rim.
  float crown = step(.5, vNormal.y) * step(${(ROWS - 1).toFixed(1)}, vRow + .5);
  // Ink faces (a breath of plum so they read against the sky), orange tile edges, Wick's warm pool on the near faces.
  vec3 col = (P_INK + .025 * P_PLUM) * (.6 + 1.2 * facing) * (.8 + uLight);
  col += P_ORANGE * rim * (.07 + .22 * uLight) * (1. + 2. * crown);
  col += P_AMBER * uWickGlow * .5 / (1. + d2 / 10.) * (.2 + .8 * facing) * (.3 + .7 * rim);
  // Bar 22, the densest bar: every footfall (kick) flickers a fresh half of the tiles; between them a few tiles
  // twinkle on each 16th, so the walls stay restless through the whole bar.
  float sel = step(.5, fract(vHash * 7.13 + uKickN * .618)), twinkle = step(.85, fract(vHash * 13.1 + uStep * .618));
  col += lightRamp(.62) * uBar22 * (1.2 * uKick * sel + .45 * twinkle) * (.35 + .65 * rim);
  // M6 hammer: crimson → amber flashes, strongest on the walls just ahead of Wick.
  float hit = step(.4, fract(vHash * 3.71 + uHitN * .382)), ahead = smoothstep(-6., 4., vArc - uA) * (1. - smoothstep(18., 30., vArc - uA));
  col += mix(P_CRIMSON, P_AMBER, .35 + .3 * rim) * 1.6 * uHammer * hit * (.25 + .75 * ahead) * (.5 + .5 * rim);
  // B7 pulse (§2.6, ×(1 + 2·pulse) tinted crimson): the faces fill with crimson, the rims burn hotter. The gain is
  // red-weighted and the wash kept below ACES's shoulder: the purple ink plus a hot crimson read pink after tone mapping.
  col = col * (1. + uPulse * vec3(.7, .05, 0.)) + P_CRIMSON * uPulse * (.2 + .25 * rim);
  float dist = length(vPos - cameraPosition), fog = exp(-pow(uFogDensity * dist, 2.));
  if (dist < .6) discard; // the chase grazes the outer U wall near arc 246: never a near-plane slab
  gl_FragColor = vec4(mix(uFogColor, col, fog), 1.);
}`;

type WallProps = {t: number; light: number; world: WorldFrame; kick: number; kickCount: number};
/** The instanced wall boxes: one draw call; all motion in the vertex shader from a few uniforms. */
const Walls = ({t, light, world, kick, kickCount}: WallProps) => {
  const w = useWorld();
  const geometry = useMemo(() => {
    const cells = buildWalls(), count = cells.length / 6 * ROWS, box = new THREE.BoxGeometry(1, 1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = box.index; (['position', 'normal', 'uv'] as const).forEach(k => g.setAttribute(k, box.getAttribute(k)));
    const wall = new Float32Array(count * 4), out = new Float32Array(count * 4);
    for (let c = 0, i = 0; c < cells.length; c += 6) for (let row = 0; row < ROWS; row++, i++) {
      wall.set([cells[c], cells[c + 1], cells[c + 2], row], i * 4);
      out.set([cells[c + 3], cells[c + 4], cells[c + 5], 0], i * 4);
    }
    g.setAttribute('aWall', new THREE.InstancedBufferAttribute(wall, 4));
    g.setAttribute('aOut', new THREE.InstancedBufferAttribute(out, 4));
    g.instanceCount = count;
    return g;
  }, []);
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader, fragmentShader,
    uniforms: {
      ...Object.fromEntries(['uT', 'uA', 'uPart', 'uSink', 'uWickGlow', 'uLight', 'uBar22', 'uKick', 'uStep', 'uKickN', 'uHammer', 'uHitN', 'uPulse', 'uFogDensity'].map(k => [k, {value: 0}])),
      uWick: {value: new THREE.Vector3()}, uFogColor: {value: new THREE.Color()},
    },
  }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    const u = material.uniforms, {wick} = world;
    // Count of M6 hits so far, so each hammer blow lights a different subset.
    let hitN = 0;
    for (const m of w.m6) hitN += lastAtOrBefore(m.hits, t) + 1;
    u.uT.value = t; u.uA.value = world.arc; u.uPart.value = smoothstep(54, 55.5, t); u.uSink.value = smoothstep(54.2, 57.3, t);
    u.uWick.value.set(wick.p[0], wick.y + .3, wick.p[2]); u.uWickGlow.value = wick.glow; u.uLight.value = light;
    u.uBar22.value = smoothstep(50.25, 50.4, t) * (1 - smoothstep(52.5, 52.65, t));
    u.uKick.value = kick; u.uKickN.value = kickCount; u.uStep.value = Math.floor((t - 50.324) / .142857);
    u.uHammer.value = world.hammer; u.uHitN.value = hitN; u.uPulse.value = world.shadow.pulse;
    u.uFogDensity.value = FOG.density; u.uFogColor.value.setRGB(...FOG.color);
  }, [material, w, t, light, world, kick, kickCount]);
  return <mesh geometry={geometry} material={material} frustumCulled={false}/>;
};

/** Chase rig plus the tunnel roll (§2.7): a slow sway and a jolt on each kick. */
const camera = ({t, world, controls: c}: SceneProps): CameraPose => {
  const pose = followRig(world, RIGS.chase, t);
  return {...pose, roll: .04 * Math.sin(.5 * t) + .03 * c.kick};
};

const Tunnel = (p: SceneProps) => {
  const {t, light, world, controls: c} = p;
  return <>
    <Backdrop light={light} glow={.12 + world.horizon.glow} center={camera(p).position} tint={world.horizon.tint} shadow={world.shadow.sky}/>
    <Plain t={t} light={light} world={world} floor={.6} swellGain={1} fog={FOG}/>
    <Walls t={t} light={light} world={world} kick={c.kick} kickCount={c.kickCount}/>
    {/* The chase rides inside the line: walkers beside the lens shrink to their size 7 tiles out (no blocks at the frame edges). */}
    <Walkers t={t} world={world} max={200} light={light} near={[2, 7]}/>
    <Wick world={world} light={light}/>
    <GhostLantern world={world} light={light}/>
    <HeraldBeams world={world}/>
  </>;
};

export const tunnel: SceneDef = {Component: Tunnel, camera};
