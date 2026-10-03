import {useEffect, useLayoutEffect, useMemo} from 'react';
import * as THREE from 'three';
import type {Vec3} from '../engine/frame';
import {PALETTE_GLSL} from '../engine/palette';

const vertexShader = `
varying vec3 vDir;
void main() {vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);}`;
const fragmentShader = `
uniform float uLight, uGlow, uHorizon;
varying vec3 vDir;
${PALETTE_GLSL}
void main() {
  float y = vDir.y - uHorizon;
  vec3 sky = mix(P_VOID, P_INK, smoothstep(.6, -.1, y));
  float band = exp(-abs(y) * mix(9., 3.5, uLight));
  gl_FragColor = vec4(sky + lightRamp(.18 + .55 * uLight) * band * uGlow * mix(.3, 1., uLight), 1.);
}`;

/**
 * center: where the sky sphere sits (keep it on the camera's region of the 160-tile world; default origin).
 * tint: horizon band ramp position (purple .286 … amber .714); shadow: 0–1 B7 sky darkening (§2.6).
 */
export type BackdropProps = {light: number; glow?: number; horizon?: number; center?: Vec3; tint?: number; shadow?: number};

/**
 * Inner sky sphere: darkness with a horizon glow that warms along the light ramp. Not fogged, never depth-writes.
 * STUB (Phase 0): `tint` and `shadow` are accepted but not yet shaded (WP1).
 */
export const Backdrop = ({light, glow = 1, horizon = 0, center}: BackdropProps) => {
  const material = useMemo(() => new THREE.ShaderMaterial({
    vertexShader, fragmentShader, side: THREE.BackSide, depthWrite: false,
    uniforms: {uLight: {value: 0}, uGlow: {value: 0}, uHorizon: {value: 0}},
  }), []);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {material.uniforms.uLight.value = light; material.uniforms.uGlow.value = glow; material.uniforms.uHorizon.value = horizon;}, [material, light, glow, horizon]);
  return <mesh material={material} position={center} scale={90} renderOrder={-1} frustumCulled={false}><sphereGeometry args={[1, 48, 24]}/></mesh>;
};
