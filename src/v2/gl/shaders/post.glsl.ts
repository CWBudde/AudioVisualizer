// Dual-filter bloom (downsample chain, then tent upsample adding each level back).
export const DOWN = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uSrc;
uniform vec2 uDst, uTexel;
uniform float uThreshold;
void main() {
  vec2 uv = gl_FragCoord.xy / uDst, h = uTexel;
  vec3 c = texture(uSrc, uv).rgb * 4. + texture(uSrc, uv - h).rgb + texture(uSrc, uv + h).rgb
    + texture(uSrc, uv + vec2(h.x, -h.y)).rgb + texture(uSrc, uv - vec2(h.x, -h.y)).rgb;
  c /= 8.;
  // Soft threshold on the first level only (uThreshold < 0 disables it).
  if (uThreshold >= 0.) c *= smoothstep(uThreshold, uThreshold + .35, max(c.r, max(c.g, c.b)));
  o = vec4(c, 1.);
}`;

export const UP = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uSrc, uBase;
uniform vec2 uDst, uTexel;
void main() {
  vec2 uv = gl_FragCoord.xy / uDst, h = uTexel;
  vec3 c = texture(uSrc, uv + vec2(-2. * h.x, 0.)).rgb + texture(uSrc, uv + vec2(2. * h.x, 0.)).rgb
    + texture(uSrc, uv + vec2(0., 2. * h.y)).rgb + texture(uSrc, uv + vec2(0., -2. * h.y)).rgb
    + (texture(uSrc, uv + h).rgb + texture(uSrc, uv - h).rgb + texture(uSrc, uv + vec2(h.x, -h.y)).rgb + texture(uSrc, uv - vec2(h.x, -h.y)).rgb) * 2.;
  o = vec4(c / 12. + texture(uBase, uv).rgb, 1.);
}`;

// Final grade: chromatic aberration, bloom, saturation, ACES tonemap, vignette, seeded grain.
export const COMPOSITE = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uScene, uBloom;
uniform vec2 uRes;
uniform float uBloomAmount, uAberration, uSaturation, uBrightness, uGrain, uFrame;
float hash(vec2 p) {p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y);}
vec3 aces(vec3 x) {return clamp(x * (2.51 * x + .03) / (x * (2.43 * x + .59) + .14), 0., 1.);}
void main() {
  vec2 uv = gl_FragCoord.xy / uRes, c = uv - .5;
  vec2 shift = c * uAberration * .012 * (.3 + 2. * dot(c, c));
  vec3 col = vec3(texture(uScene, uv + shift).r, texture(uScene, uv).g, texture(uScene, uv - shift).b);
  col += texture(uBloom, uv).rgb * uBloomAmount;
  col = mix(vec3(dot(col, vec3(.2126, .7152, .0722))), col, uSaturation);
  col = aces(col * uBrightness * 1.25);
  col *= 1. - .55 * dot(c, c);
  // Keep hash inputs small: large coordinates lose float precision and show as stripes.
  col += (hash(gl_FragCoord.xy * .01 + fract(uFrame * .6180339) * 7.) - .5) * uGrain;
  o = vec4(col, 1.);
}`;
