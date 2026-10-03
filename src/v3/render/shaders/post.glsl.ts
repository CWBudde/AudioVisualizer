import {ACES, HASH} from '../../../shared/glsl/bloom';
import {PALETTE_GLSL} from '../../engine/palette';

export {DOWN, UP, raw} from '../../../shared/glsl/bloom';
/** First bloom level keeps only linear HDR above this luminance. */
export const BLOOM_THRESHOLD = .7;
// v3 grade: same aberration/bloom/ACES/grain as v2, but the scene is linear HDR, so encode to sRGB before grain.
// uFlash is the global warm flash (FLASHES) in linear HDR: it lifts what is lit (gain) and lays a thin veil of light-ramp
// position uFlashTone over the frame, stronger at the centre, so a dark frame warms without flattening to one colour.
export const COMPOSITE = `
precision highp float;
out vec4 o;
uniform sampler2D uScene, uBloom;
uniform vec2 uRes;
uniform float uBloomAmount, uAberration, uSaturation, uExposure, uGrain, uFrame, uVignette, uFlash, uFlashTone;
${HASH}
${PALETTE_GLSL}
${ACES}
vec3 srgb(vec3 c) {return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c));}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes, c = uv - .5;
  vec2 shift = c * uAberration * .012 * (.3 + 2. * dot(c, c));
  vec3 col = vec3(texture(uScene, uv + shift).r, texture(uScene, uv).g, texture(uScene, uv - shift).b);
  col += texture(uBloom, uv).rgb * uBloomAmount;
  col = col * (1. + uFlash) + lightRamp(uFlashTone) * uFlash * .15 * (1. - 1.2 * dot(c, c));
  col = max(mix(vec3(dot(col, vec3(.2126, .7152, .0722))), col, uSaturation), 0.);
  col = aces(col * uExposure);
  col *= 1. - uVignette * dot(c, c);
  // Keep hash inputs small: large coordinates lose float precision and show as stripes.
  col = srgb(col) + (hash(gl_FragCoord.xy * .01 + fract(uFrame * .6180339) * 7.) - .5) * uGrain;
  o = vec4(col, 1.);
}`;
