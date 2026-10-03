import {PALETTE_GLSL} from '../../engine/palette';
import {GLYPH, NOISE} from './glyph.glsl';

// Fullscreen triangle for RawShaderMaterial passes (three prepends #version 300 es).
export const FULLSCREEN = `
in vec3 position;
out vec2 vUv;
void main() {vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.);}`;

// Blends layer A (outgoing) into B (incoming). Linear HDR in, linear HDR out; every edge is soft and
// every effect is zero at progress 0 and 1, so the layer boundaries never pop.
export const TRANSITION = `
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uA, uB;
uniform int uCount, uKind;
uniform float uProgress, uSeed, uWash, uLight, uMorph;
uniform vec2 uCenter;
${PALETTE_GLSL}
${GLYPH}
${NOISE}
void main() {
  vec3 a = texture(uA, vUv).rgb;
  if (uCount < 2) {o = vec4(a, 1.); return;}
  vec3 b = texture(uB, vUv).rgb;
  float p = clamp(uProgress, 0., 1.), e = smoothstep(0., 1., p), ends = smoothstep(0., .06, p) * smoothstep(1., .94, p);
  vec3 col = mix(a, b, e);
  if (uKind == 1) {
    // Burn: an fbm front eats A; just ahead of it A chars, on it a hot orange→yellow rim.
    float n = clamp((fbm(vUv * 1.8 + uSeed * 37.) - .22) / .56, 0., 1.);
    float d = n - mix(-.2, 1.2, p);
    col = mix(b, a * mix(.25, 1., smoothstep(0., .14, d)), smoothstep(-.012, .012, d));
    float rim = exp(-abs(d) / .03);
    col += mix(P_RED, P_AMBER, exp(-abs(d) / .01)) * rim * 1.8 * ends;
  } else if (uKind == 2) {
    // Wash: warm light floods the frame at the midpoint and recedes onto B.
    float flood = pow(sin(3.14159265 * p), 2.);
    col = mix(col, mix(P_ORANGE, P_AMBER, uLight) * uWash, .85 * flood);
  } else if (uKind == 3) {
    // Iris: B opens inside the motif glyph, centred where the persistent glyph sits.
    vec2 q = vUv - uCenter;
    float s = 2.6 * pow(p, 1.7), d = (glyphNorm(q, uMorph) - s) * .7071;
    col = mix(a, b, smoothstep(.004, -.004, d) * smoothstep(0., .02, p));
    col += mix(P_ORANGE, P_AMBER, exp(-abs(d) / .004)) * exp(-abs(d) / .015) * 1.6 * ends;
  }
  o = vec4(max(col, 0.), 1.);
}`;
