import {PALETTE_GLSL} from '../../engine/palette';
import {CREST} from './crest.glsl';
import {NOISE} from './glyph.glsl';

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
uniform float uProgress, uSeed, uWash, uLight;
uniform vec2 uCenter;
${PALETTE_GLSL}
${CREST}
${NOISE}
void main() {
  vec3 a = texture(uA, vUv).rgb;
  if (uCount < 2) {o = vec4(a, 1.); return;}
  vec3 b = texture(uB, vUv).rgb;
  float p = clamp(uProgress, 0., 1.), e = smoothstep(0., 1., p), ends = smoothstep(0., .06, p) * smoothstep(1., .94, p);
  vec3 col = mix(a, b, e);
  if (uKind == 1) {
    // Burn: an fbm front eats A outward from uCenter (Wick); just ahead of it A chars, on it a hot orange→yellow rim.
    float n = clamp((fbm(vUv * 1.8 + uSeed * 37.) - .22) / .56, 0., 1.);
    float m = .55 * n + .45 * clamp(length(vUv - uCenter) / .9, 0., 1.);
    float d = m - mix(-.2, 1.2, p);
    col = mix(b, a * mix(.25, 1., smoothstep(0., .14, d)), smoothstep(-.012, .012, d));
    // A thin fiery edge (a few px whatever the front's slope; the radial term makes m shallow): a hot amber→yellow core
    // that flickers along the front, and a low red ember fringe on the unburnt side, kept under the bloom threshold.
    float w = max(fwidth(d), 1e-4), flick = .2 + 2.4 * pow(fbm(vUv * 26. + vec2(p * 4.1, uSeed * 17.)), 2.);
    float core = exp(-abs(d) / (1.3 * w)), fringe = step(0., d) * exp(-max(d, 0.) / (5. * w)); // max: exp of −d/w overflows to inf, and 0 · inf is NaN (black)
    col += (mix(P_ORANGE, P_YELLOW, core) * core * flick + P_RED * fringe * .3 * (.5 + .5 * flick)) * ends;
  } else if (uKind == 2) {
    // Wash: warm light floods the frame at the midpoint and recedes onto B.
    float flood = pow(sin(3.14159265 * p), 2.);
    col = mix(col, mix(P_ORANGE, P_AMBER, uLight) * uWash, .85 * flood);
  } else if (uKind == 3) {
    // Iris: B opens inside Wick's crest, grown about the crest anchor (uCenter). s = 12 at p = 1 covers the screen diagonal
    // with the anchor's inradius .25; p³ (§5 says p²) keeps the whole crest silhouette on screen at the midpoint. d in UV units.
    float s = max(12. * p * p * p, 1e-4), d = crestSdf((vUv - uCenter) * 2. / s + ANCHOR) * s / 2.;
    col = mix(a, b, smoothstep(.004, -.004, d) * smoothstep(0., .02, p));
    col += mix(P_ORANGE, P_AMBER, exp(-abs(d) / .004)) * exp(-abs(d) / .009) * 1.3 * ends;
  }
  o = vec4(max(col, 0.), 1.);
}`;
