// The motif glyph, shared by the motif overlay, the ember sprites and the iris transition.
// A diamond (morph 0) that pinches into a four-pointed star (morph 1). The norm is homogeneous
// (glyphNorm(k p) = k glyphNorm(p)), so `glyphNorm(p) < s` is the glyph scaled by s, tips on the axes at s.
export const GLYPH = `
float glyphNorm(vec2 p, float morph) {
  float k = mix(1., .55, clamp(morph, 0., 1.));
  p = abs(p) + 1e-5;
  return pow(pow(p.x, k) + pow(p.y, k), 1. / k);
}
float glyphSdf(vec2 p, float morph) {return (glyphNorm(p, morph) - 1.) * .7071;}`;

export const NOISE = `
float hash12(vec2 p) {vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z);}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + 1.), f.x), f.y);
}
float fbm(vec2 p) {float v = 0., a = .5; for (int i = 0; i < 5; i++) {v += a * noise(p); p = mat2(.8, -.6, .6, .8) * p * 2.03; a *= .5;} return v;}`;
