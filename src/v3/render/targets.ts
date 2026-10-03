import * as THREE from 'three';

/** MSAA samples on the scene layers (ANGLE/Metal resolves multisampled RGBA16F). */
export const LAYER_SAMPLES = 4;

/** Linear HDR render target; depth only for scene layers. */
export const hdrTarget = (size: number, {depth = false, samples = 0} = {}) => new THREE.WebGLRenderTarget(size, size, {
  type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
  depthBuffer: depth, stencilBuffer: false, generateMipmaps: false, samples,
});
/** Two scene layers, the blended HDR frame and the dual-filter bloom chain (halving per level). */
export function createTargets(size: number, levels: number, samples: number) {
  const downs = Array.from({length: levels}, (_, i) => hdrTarget(Math.ceil(size / 2 ** (i + 1))));
  const t = {layers: [0, 1].map(() => hdrTarget(size, {depth: true, samples})), hdr: hdrTarget(size), downs, ups: downs.slice(0, -1).map(d => hdrTarget(d.width))};
  return {...t, dispose: () => [...t.layers, t.hdr, ...t.downs, ...t.ups].forEach(x => x.dispose())};
}
/** One triangle covering the viewport; three needs a `position` attribute to size the draw call. */
export const fullscreenTriangle = () => new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
