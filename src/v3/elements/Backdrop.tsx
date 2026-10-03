import {useEffect, useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import type {Vec3} from '../engine/frame';
import {PALETTE_GLSL} from '../engine/palette';

const vertexShader = `
varying vec3 vDir;
void main() {vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);}`;
const fragmentShader = `
uniform float uLight, uGlow, uHorizon, uTint, uShadow;
varying vec3 vDir;
${PALETTE_GLSL}
void main() {
  float y = vDir.y - uHorizon;
  vec3 sky = mix(P_VOID, P_INK, smoothstep(.6, -.1, y));
  // B7 sky shadow: the upper sky sinks toward void with a crimson-purple cast.
  sky = mix(sky, mix(P_VOID, mix(P_CRIMSON, P_PURPLE, .6) * .12, smoothstep(-.1, .5, y)), uShadow);
  float band = exp(-abs(y) * mix(9., 3.5, uLight));
  // Band color: the light ramp by default, or the given tint (purple .286 … amber .714); the shadow pulls it crimson-purple.
  vec3 tint = uTint < 0. ? lightRamp(.18 + .55 * uLight) : lightRamp(uTint);
  tint = mix(tint, mix(P_CRIMSON, P_PURPLE, .5), .7 * uShadow);
  gl_FragColor = vec4(sky + tint * band * uGlow * mix(.3, 1., max(uLight, .35 * step(0., uTint))), 1.);
}`;

/**
 * center: where the sky sphere sits (keep it on the camera's region of the 160-tile world; default origin).
 * tint: horizon band ramp position (purple .286 … amber .714); shadow: 0–1 B7 sky darkening (§2.6).
 */
export type BackdropProps = {light: number; glow?: number; horizon?: number; center?: Vec3; tint?: number; shadow?: number};

/**
 * Inner sky sphere: darkness with a horizon glow that warms along the light ramp. Not fogged, never depth-writes.
 * Pass world.horizon.tint / world.shadow.sky for the §2.6 band and sky shadow; tint omitted keeps the light-ramp band.
 */
export const Backdrop = ({light, glow = 1, horizon = 0, center, tint = -1, shadow = 0}: BackdropProps) => {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader, fragmentShader, side: THREE.BackSide, depthWrite: false,
    uniforms: {uLight: {value: 0}, uGlow: {value: 0}, uHorizon: {value: 0}, uTint: {value: -1}, uShadow: {value: 0}},
  }), []);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    const u = material.uniforms;
    u.uLight.value = light; u.uGlow.value = glow; u.uHorizon.value = horizon; u.uTint.value = tint; u.uShadow.value = shadow;
  }, [material, light, glow, horizon, tint, shadow]);
  return <mesh material={material} position={center} scale={90} renderOrder={-1} frustumCulled={false}><sphereGeometry args={[1, 48, 24]}/></mesh>;
};
