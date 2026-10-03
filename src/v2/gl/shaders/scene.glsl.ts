// Scene pass: five worlds blended by the director's weights, plus the melody ribbon.
// Coordinates: p is centered, y spans -0.5..0.5. Every term depends only on uniforms.
export const SCENE = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes;
uniform float uTime, uBeat, uBar;
uniform float uVoid, uTunnel, uKaleido, uAurora, uFragments;
uniform float uZoom, uRoll, uTravel, uFolds, uFoldSpin, uDiamond, uAccent, uCollapse, uRibbon, uRibbonFold, uHueOff;
uniform float uKick, uSnare, uHat, uBass, uHarm, uEnergy, uVocal, uPitch, uVoicing;
uniform int uNoteCount;
uniform vec4 uNotes[16];
uniform float uNoteHue[16];

#define TAU 6.2831853
const vec3 NAVY = vec3(.035, .045, .11);
const vec3 CYAN = vec3(.21, .90, 1.), PINK = vec3(1., .24, .66), VIOLET = vec3(.53, .35, 1.), ACID = vec3(.91, 1., .44);

mat2 rot(float a) {float c = cos(a), s = sin(a); return mat2(c, -s, s, c);}
float hash(vec2 p) {p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y);}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + 1.), f.x), f.y);
}
float fbm(vec2 p) {float v = 0., a = .5; for (int i = 0; i < 5; i++) {v += a * noise(p); p = rot(.5) * p * 2.03; a *= .5;} return v;}
// Hue rotation in YIQ space keeps luminance while harmony shifts the palette.
vec3 hueShift(vec3 c, float s) {
  const mat3 toYIQ = mat3(.299, .596, .211, .587, -.274, -.523, .114, -.322, .312);
  const mat3 toRGB = mat3(1., 1., 1., .956, -.272, -1.106, .621, -.647, 1.703);
  vec3 yiq = toYIQ * c; yiq.yz = rot(s * TAU) * yiq.yz;
  return max(toRGB * yiq, 0.);
}
vec3 pal(float x) {
  x = fract(x);
  vec3 c = x < 1. / 3. ? mix(CYAN, PINK, x * 3.) : x < 2. / 3. ? mix(PINK, VIOLET, x * 3. - 1.) : mix(VIOLET, CYAN, x * 3. - 2.);
  return hueShift(c, uHueOff);
}
// Anti-aliased glow around a distance field, width in pixels.
float edge(float d, float px) {return exp(-abs(d) / max(fwidth(d) * px, 1e-5));}
vec2 fold(vec2 p, float n, float spin) {
  float s = TAU / n, a = mod(atan(p.y, p.x) + spin, s);
  a = abs(a - s * .5);
  return length(p) * vec2(cos(a), sin(a));
}
float sdSeg(vec2 p, vec2 a, vec2 b) {vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0., 1.));}
float sdTri(vec2 p, float r) {
  const float k = 1.7320508; p.x = abs(p.x) - r; p.y += r / k;
  if (p.x + k * p.y > 0.) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.;
  p.x -= clamp(p.x, -2. * r, 0.);
  return -length(p) * sign(p.y);
}

// Neon tunnel: rings at integer depth travel toward the camera; kick lights the nearest ones.
vec3 tunnel(vec2 p, float shape) {
  float a = atan(p.y, p.x);
  float r = mix(length(p), (abs(p.x) + abs(p.y)) * .7071, shape);
  r *= 1. + .07 * uBass * sin(a * 4. + uTravel * 1.5);
  float z = .5 / max(r, 1e-3), Z = z + uTravel;
  float fog = exp(-z * .14) * smoothstep(.0, .06, r);
  float index = floor(Z + .5);
  float ring = exp(-abs(Z - index) / max(fwidth(Z), 1e-5) / (1.2 + 3. * fog)) * smoothstep(.7, .2, fwidth(Z));
  vec3 ringColor = mix(pal(index * .17 + .03 * uBar), ACID, uAccent * step(mod(index, 4.), .5));
  float spokes = a / TAU * 16.;
  float spoke = exp(-abs(fract(spokes + .5) - .5) / max(fwidth(spokes), 1e-5) / 1.3);
  spoke *= (.2 + .8 * uBass) * (.5 + .5 * sin(Z * TAU * .5 - uBeat * TAU));
  vec3 col = ringColor * ring * fog * (1.4 + 3. * uKick * exp(-z * .35));
  col += pal(.6 + a / TAU) * spoke * fog * .45;
  col += pal(uTime * .02 + .5) * exp(-r * 30.) * (.2 + .4 * uEnergy);
  return col;
}

// Kaleidoscope: tunnel slices and log-polar diamond lattices in two counter-rotating folds.
vec3 lattice(vec2 f, float travel, float tint) {
  float r = length(f), ang = atan(f.y, f.x);
  vec2 lp = vec2(log(r + 1e-3) * 3. - travel, ang * 3.);
  vec2 cell = vec2(fract(lp.x) - .5, lp.y - .4);
  float d = abs(cell.x) + abs(cell.y) * 1.5 - .3;
  float k = floor(lp.x);
  return pal(k * .13 + tint) * (edge(d, 1.5) * 1.2 + smoothstep(.0, -.05, d) * .06) * smoothstep(.03, .25, r);
}
vec3 kaleido(vec2 p) {
  vec2 f = fold(p, uFolds, uFoldSpin), g = fold(rot(.3) * p * 1.35, uFolds, -uFoldSpin * 1.3);
  vec3 col = tunnel(f * 1.1, 1.) * .5;
  col += lattice(f, uTravel * .35, 0.) * (.6 + .9 * uKick);
  col += lattice(g, uTravel * .2 + .5, .5) * .5 * (.5 + uHarm);
  return col;
}

// Aurora curtains shaped by harmonic energy; the melody lifts them.
vec3 aurora(vec2 p) {
  vec3 col = vec3(0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float w = fbm(vec2(p.x * 2.2 + uTime * .05 * (1. + fi * .3) + fi * .37, uTime * .04 + fi));
    float d = p.y - ((w - .5) * .6 + (fi - 1.) * .17 + (uPitch - .5) * .25);
    float band = exp(-abs(d) * (24. - 8. * uHarm)) * (.2 + .5 * uHarm);
    float rays = .55 + .45 * fbm(vec2(p.x * 14. + fi * 3., d * 2. - uTime * .2));
    col += pal(.12 * fi + .35 + w * .4) * (band * rays * .7 + exp(-abs(d) * 5.) * .04);
  }
  return col;
}

// Zero-gravity shards on three parallax layers.
vec3 fragments(vec2 p) {
  vec3 col = vec3(0);
  for (int layer = 0; layer < 3; layer++) {
    float fl = float(layer), scale = 3. + fl * 2.5;
    vec2 q = p * scale + vec2(uTime * .05, -uTime * .03) * (fl + 1.) + fl * 7.3;
    vec2 id = floor(q), f = fract(q) - .5;
    float px = fwidth(q.x);
    float h = hash(id + fl * 13.);
    if (h < .5) continue;
    f = rot(h * TAU + uTime * (h - .75) * 1.6) * (f + (vec2(hash(id + 3.), hash(id + 5.)) - .5) * .3);
    float d = sdTri(f, .14 + .12 * hash(id + 9.));
    float glow = exp(-abs(d) / (px * 1.4)) * 1.2 + smoothstep(.0, -.02, d) * .1;
    col += pal(h * 2. + fl * .2) * glow / (1. + fl * .6) * (.45 + .6 * uHarm + .9 * uKick);
  }
  return col;
}

// Starfield and a chroma-tinted nebula for the quiet opening.
vec3 voidWorld(vec2 p) {
  vec3 col = vec3(0);
  for (int layer = 0; layer < 2; layer++) {
    vec2 q = p * (18. + float(layer) * 14.) + float(layer) * 5.;
    vec2 id = floor(q), f = fract(q) - .5;
    float h = hash(id);
    if (h < .9) continue;
    float d = length(f - (vec2(hash(id + 1.), hash(id + 2.)) - .5) * .6);
    col += mix(CYAN, VIOLET, hash(id + 4.)) * exp(-d * 35.) * (.45 + .55 * sin(uTime * 1.5 + h * 40.)) * (.6 + 1.2 * uHat);
  }
  col += pal(.55 + .1 * fbm(p * 2.)) * fbm(p * 1.5 + uTime * .02) * .14 * (1. + uHarm + uVocal);
  return col;
}

// Melody ribbon: notes scroll left from the playhead, height is pitch, onsets flare.
float noteX(float age) {return .32 - age * .26;}
float noteY(float pitch) {return (pitch - .5) * .62;}
vec3 ribbon(vec2 p) {
  vec3 col = vec3(0);
  vec2 previous = vec2(0);
  for (int i = 0; i < 16; i++) {
    if (i >= uNoteCount) break;
    vec4 n = uNotes[i];
    vec2 a = vec2(noteX(n.x), noteY(n.z)), b = vec2(noteX(n.y), noteY(n.z));
    vec3 c = pal(uNoteHue[i]);
    float fade = exp(-n.y * .9) * (.7 + .7 * n.w), w = .007 + .008 * n.w;
    col += c * exp(-sdSeg(p, a, b) / w) * 1.5 * fade;
    if (i > 0) col += c * exp(-sdSeg(p, previous, a) / (w * .6)) * .4 * fade;
    previous = b;
    if (n.x < .45) {
      float life = 1. - n.x / .45;
      col += c * exp(-abs(length(p - a) - (.015 + n.x * .22)) / .004) * life * 1.3 * n.w;
      col += vec3(1) * exp(-length(p - a) / .012) * exp(-n.x * 10.) * 1.6;
    }
  }
  col += mix(CYAN, vec3(1), .6) * exp(-length(p - vec2(noteX(0.), noteY(uPitch))) / .01) * uVoicing * .9;
  return col;
}

void main() {
  vec2 p0 = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  float scale = uZoom * max(1. - .96 * uCollapse, .04);
  vec2 p = rot(uRoll) * p0 / scale;
  // The melody ribbon stays upright so higher pitch always reads as higher on screen.
  vec2 pr = p0 / scale;
  vec3 col = NAVY * (1.15 - .6 * length(p0));
  if (uVoid > .001) col += voidWorld(p) * uVoid;
  if (uTunnel > .001) col += tunnel(p, uDiamond) * uTunnel;
  if (uKaleido > .001) col += kaleido(p) * uKaleido;
  if (uAurora > .001) col += aurora(p) * uAurora;
  if (uFragments > .001) col += fragments(p) * uFragments;
  if (uRibbon > .001) {
    if (uRibbonFold < .999) col += ribbon(pr) * uRibbon * (1. - uRibbonFold);
    if (uRibbonFold > .001) col += ribbon(fold(p, uFolds, uFoldSpin)) * uRibbon * uRibbonFold * .8;
  }
  // Measured pauses: the world shrinks into one glowing point.
  col *= 1. - .85 * uCollapse * smoothstep(.02, .2, length(p0));
  col += mix(CYAN, vec3(1), .5) * exp(-length(p0) * 55.) * uCollapse * 1.5;
  o = vec4(col, 1.);
}`;
