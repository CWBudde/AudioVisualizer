import {clamp} from './easing';

// Warm light emerging from darkness. Hex values are sRGB; shaders and three materials work in linear.
export const PALETTE = {
  void: '#06030a', ink: '#140820', plum: '#3b0f4f', purple: '#7a2fa0', crimson: '#b3162e',
  red: '#e0352b', orange: '#ff7b1c', amber: '#ffae2b', yellow: '#ffd84a', flare: '#fff3c4',
} as const;
export type Tone = keyof typeof PALETTE;
export type RGB = [number, number, number];
/** The darkness→light arc: x = 0 is void, x = 1 is flare. */
export const LIGHT_RAMP: Tone[] = ['void', 'plum', 'purple', 'crimson', 'orange', 'amber', 'yellow', 'flare'];

const channel = (c: number) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
export const toLinear = (hex: string): RGB => [1, 3, 5].map(i => channel(parseInt(hex.slice(i, i + 2), 16) / 255)) as RGB;
export const tone = (name: Tone) => toLinear(PALETTE[name]);
export const mixRGB = (a: RGB, b: RGB, x: number): RGB => [a[0] + (b[0] - a[0]) * x, a[1] + (b[1] - a[1]) * x, a[2] + (b[2] - a[2]) * x];
export const scaleRGB = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
/** Linear RGB at position x on the light ramp. */
export function lightRamp(x: number): RGB {
  const p = clamp(x) * (LIGHT_RAMP.length - 1), i = Math.min(Math.floor(p), LIGHT_RAMP.length - 2);
  return mixRGB(tone(LIGHT_RAMP[i]), tone(LIGHT_RAMP[i + 1]), p - i);
}

const vec3 = ([r, g, b]: RGB) => `vec3(${r.toFixed(5)}, ${g.toFixed(5)}, ${b.toFixed(5)})`;
/** The same palette as GLSL constants (P_VOID … P_FLARE) plus lightRamp(x). */
export const PALETTE_GLSL = `${(Object.keys(PALETTE) as Tone[]).map(k => `const vec3 P_${k.toUpperCase()} = ${vec3(tone(k))};`).join('\n')}
vec3 lightRamp(float x) {
  float p = clamp(x, 0., 1.) * ${LIGHT_RAMP.length - 1}.;
${LIGHT_RAMP.slice(0, -1).map((k, i) => `  if (p < ${i + 1}.) return mix(P_${k.toUpperCase()}, P_${LIGHT_RAMP[i + 1].toUpperCase()}, p - ${i}.);`).join('\n')}
  return P_FLARE;
}`;
