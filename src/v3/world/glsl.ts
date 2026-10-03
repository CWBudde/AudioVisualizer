import {useEffect, useMemo} from 'react';
import * as THREE from 'three';
import type {RGB} from '../engine/palette';
import {tone} from '../engine/palette';

// Shared shader bits of the world elements (vertex-lit, emissive only: everything here glows, nothing is shaded by lights).

/** exp² fog applied per vertex: fogged(col, worldPos). Needs uFogDensity, uFogColor. */
export const FOG_GLSL = `
uniform float uFogDensity;
uniform vec3 uFogColor;
vec3 fogged(vec3 col, vec3 wp) {float d = uFogDensity * length(wp - cameraPosition); return mix(col, uFogColor, 1. - exp(-d * d));}`;

export type Fog = {density: number; color: RGB};
/** Default plain fog: faint, into the void, so the 160-tile grid never shows a hard horizon. */
export const DEFAULT_FOG: Fog = {density: .012, color: tone('void')};

/** A ShaderMaterial built once per mount, disposed on unmount. Set per-frame uniforms in useLayoutEffect. */
export function useShader(make: () => THREE.ShaderMaterial) {
  const material = useMemo(make, []);
  useEffect(() => () => material.dispose(), [material]);
  return material;
}
/** Uniform map from names with initial values. */
export const uniforms = (u: Record<string, unknown>) => Object.fromEntries(Object.entries(u).map(([k, value]) => [k, {value}]));

/** Unit quad in XY (±.5) for billboards. */
export const QUAD = new THREE.PlaneGeometry(1, 1);
