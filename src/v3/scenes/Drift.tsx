import {useEffect, useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import {Backdrop} from '../elements/Backdrop';
import {Embers} from '../elements/Embers';
import {smoothstep} from '../engine/easing';
import type {CameraPose, SceneProps} from '../engine/frame';
import {PALETTE_GLSL} from '../engine/palette';
import {seedOf} from '../engine/random';
import {routeFrame, routePoint, useWorld} from '../world';
import type {WorldFrame} from '../world';
import {lastAtOrBefore} from '../world/clock';
import {GhostLantern} from '../world/GhostLantern';
import {Walkers} from '../world/Walkers';
import {Wick} from '../world/Wick';
import type {SceneDef} from './registry';

// drift (§4.4): the floor is gone. Wick walks on over nothing, the walkers float behind it as embers, the sky goes
// crimson-purple on B7 and the embers snap into the future tunnel walls on the 44.03 snare. Owned by WP4.

// The orbit starts on the interlocking side: a0 = atan2(−cam.h − cam.r) at 36.6. camArc(36.6) ≈ 201.3 lies on the
// straight climb of column 3 (186–240), where the smoothed heading is exactly north for any arc in 194–232, so the
// frame at 202 gives the same a0 as the measured arc.
const start = routeFrame(202), a0 = Math.atan2(-start.h[2] - start.r[2], -start.h[0] - start.r[0]);
const camera = ({t, world}: SceneProps): CameraPose => {
  const {p, y} = world.cam, a = a0 + .12 * (t - 36.6);
  // [C] While the embers hang in the B7 sky, the orbit lifts its gaze a little; it settles as they snap into the grids.
  const look = 1.2 * smoothstep(41.18, 43.2, t) * (1 - smoothstep(43.9, 44.6, t));
  return {position: [p[0] + 12 * Math.cos(a), y + 4 + 1.5 * Math.sin(.21 * t), p[2] + 12 * Math.sin(a)], target: [p[0], y + 1.5 + look, p[2]], fov: 50, roll: .05 * Math.sin(.3 * t)};
};

// Stepping stones: each note still lights the tile under Wick's step, but there is no plain to keep it,
// so the tile flashes under the foot and falls away into the void, cooling yellow → crimson.
const STONES = 6, LAND = .06;
const stoneVS = `
attribute vec4 aStone;  // x, y, z, size
attribute vec2 aLook;   // gain, ramp x
varying vec2 vUv;
varying vec2 vLook;
void main() {
  vUv = position.xy * 2.; vLook = aLook;
  vec3 p = aStone.xyz + vec3(position.x, 0., -position.y) * aStone.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.);
}`;
const stoneFS = `
varying vec2 vUv;
varying vec2 vLook;
${PALETTE_GLSL}
void main() {
  float e = max(abs(vUv.x), abs(vUv.y));
  float a = smoothstep(1., .85, e) * (.35 + .65 * exp(-max(1. - e, 0.) / .12));
  gl_FragColor = vec4(lightRamp(vLook.y) * vLook.x * a, 1.);
}`;

/** Wick's drift climb at note i (§2.3), so a stone sits under the foot that lit it. */
const climbAt = (w: ReturnType<typeof useWorld>, i: number) => .15 * Math.max(0, w.noteMidi[i] - 74) * (1 - smoothstep(45, 45.75, w.noteStart[i]));

const Stones = ({world}: {world: WorldFrame}) => {
  const w = useWorld();
  const geometry = useMemo(() => {
    const g = new THREE.InstancedBufferGeometry(), quad = new THREE.PlaneGeometry(1, 1);
    g.index = quad.index; g.setAttribute('position', quad.getAttribute('position'));
    g.setAttribute('aStone', new THREE.InstancedBufferAttribute(new Float32Array(STONES * 4), 4));
    g.setAttribute('aLook', new THREE.InstancedBufferAttribute(new Float32Array(STONES * 2), 2));
    g.instanceCount = STONES;
    return g;
  }, []);
  const material = useMemo(() => new THREE.ShaderMaterial({vertexShader: stoneVS, fragmentShader: stoneFS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide}), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    const stone = geometry.getAttribute('aStone') as THREE.InstancedBufferAttribute, look = geometry.getAttribute('aLook') as THREE.InstancedBufferAttribute;
    const tau = world.held, k = lastAtOrBefore(w.noteStart, tau);
    for (let j = 0; j < STONES; j++) {
      // Lit as the foot lands (Wick eases onto the tile over .09 s), not while it is still a step ahead.
      const i = k - j, age = i >= 0 ? tau - w.noteStart[i] - LAND : 9;
      const p = routePoint(i >= 0 ? w.noteArc[i] : 0), vel = i >= 0 ? (w.noteVel[i] / 127) ** .7 : 0;
      const gain = age >= 0 && age < 1.6 ? vel * (1.8 * Math.exp(-age / .1) + .45 * Math.exp(-age / .5)) * (1 - smoothstep(1, 1.6, age)) : 0;
      const fall = Math.max(age, 0);
      stone.setXYZW(j, p[0], (i >= 0 ? climbAt(w, i) : 0) - 1.4 * fall * fall, p[2], .92 * (1 - .25 * Math.min(fall, 1)));
      look.setXY(j, gain, .86 - .44 * Math.min(fall / .9, 1));
    }
    stone.needsUpdate = true; look.needsUpdate = true;
  }, [geometry, w, world]);
  return <mesh geometry={geometry} material={material} frustumCulled={false}/>;
};

const Drift = (p: SceneProps) => {
  const {t, light, world, presence} = p, cam = camera(p);
  return <>
    <Backdrop light={light} glow={.35 + world.horizon.glow} center={cam.position} tint={world.horizon.tint} shadow={world.shadow.sky}/>
    {/* Far dust in the void: depth and a few warm points, never a floor. */}
    <group position={[world.cam.p[0], world.cam.y + 2, world.cam.p[2]]}>
      <Embers seed={seedOf('drift-dust')} count={200} t={t} presence={presence} mode="drift" radius={34} light={light} pulse={0} size={.2} intensity={1.3} speed={.35}/>
    </group>
    <Stones world={world}/>
    <Walkers t={t} world={world} look="ember" max={200} light={light}/>
    <Wick world={world} light={light}/>
    <GhostLantern world={world} light={light}/>
  </>;
};

export const drift: SceneDef = {Component: Drift, camera};
