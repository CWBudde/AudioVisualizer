import {createPortal, useFrame, useThree} from '@react-three/fiber';
import {Fragment, useEffect, useLayoutEffect, useMemo} from 'react';
import {getRemotionEnvironment} from 'remotion';
import * as THREE from 'three';
import {MotifLayer, MOTIF_CAMERA} from '../elements/MotifLayer';
import type {CameraPose, FrameState} from '../engine/frame';
import {SCENES} from '../scenes/registry';
import {WorldContext} from '../world';
import type {World} from '../world';
import type {SceneId} from '../scenes/registry';
import {BLOOM_THRESHOLD, COMPOSITE, DOWN, UP, raw} from './shaders/post.glsl';
import {FULLSCREEN, TRANSITION} from './shaders/transition.glsl';
import {createTargets, fullscreenTriangle, LAYER_SAMPLES} from './targets';

const SIZE = 1080, BLOOM_LEVELS = 5;
type Slot = {scene: THREE.Scene; camera: THREE.PerspectiveCamera};
type Uniforms = Record<string, THREE.IUniform>;

function createPipeline(gl: THREE.WebGLRenderer) {
  // Without float color buffers the HDR chain silently degrades to 8 bit: refuse that for real renders.
  if (!gl.getContext().getExtension('EXT_color_buffer_float') && getRemotionEnvironment().isRendering) throw new Error('EXT_color_buffer_float unavailable: v3 needs half-float render targets');
  const targets = createTargets(SIZE, BLOOM_LEVELS, LAYER_SAMPLES);
  const geometry = fullscreenTriangle();
  const material = (fragmentShader: string, uniforms: Uniforms) => new THREE.RawShaderMaterial({glslVersion: THREE.GLSL3, vertexShader: FULLSCREEN, fragmentShader, uniforms, depthTest: false, depthWrite: false});
  const u = (value: unknown) => ({value});
  const blend = material(TRANSITION, {uA: u(null), uB: u(null), uCount: u(1), uKind: u(0), uProgress: u(0), uSeed: u(0), uWash: u(0), uLight: u(0), uCenter: u(new THREE.Vector2(.5, .5))});
  const down = material(raw(DOWN), {uSrc: u(null), uDst: u(new THREE.Vector2()), uTexel: u(new THREE.Vector2()), uThreshold: u(0)});
  const up = material(raw(UP), {uSrc: u(null), uBase: u(null), uDst: u(new THREE.Vector2()), uTexel: u(new THREE.Vector2())});
  const composite = material(COMPOSITE, {uScene: u(targets.hdr.texture), uBloom: u(null), uRes: u(new THREE.Vector2(SIZE, SIZE)),
    uBloomAmount: u(1), uAberration: u(0), uSaturation: u(1), uExposure: u(1), uGrain: u(0), uFrame: u(0), uVignette: u(0), uFlash: u(0), uFlashTone: u(.714)});
  const quad = new THREE.Mesh(geometry, blend), quadScene = new THREE.Scene(), quadCamera = new THREE.Camera();
  quad.frustumCulled = false; quadScene.add(quad);
  const pass = (m: THREE.RawShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
    quad.material = m;
    if (target) m.uniforms.uDst?.value.set(target.width, target.height);
    gl.setRenderTarget(target); gl.render(quadScene, quadCamera);
  };
  return {
    update(s: FrameState) {
      const b = blend.uniforms, tr = s.transition, p = s.post, c = composite.uniforms;
      b.uCount.value = tr.count; b.uKind.value = tr.kindIndex; b.uProgress.value = tr.progress; b.uSeed.value = tr.seed;
      b.uWash.value = tr.wash; b.uLight.value = p.light; b.uCenter.value.set(...tr.center);
      c.uBloomAmount.value = p.bloom; c.uAberration.value = p.aberration; c.uSaturation.value = p.saturation;
      c.uExposure.value = p.exposure; c.uGrain.value = p.grain; c.uFrame.value = p.frame; c.uVignette.value = p.vignette;
      c.uFlash.value = p.flash; c.uFlashTone.value = p.flashTone;
    },
    render(layers: Slot[], overlay: Slot) {
      layers.forEach((l, i) => {gl.setRenderTarget(targets.layers[i]); gl.render(l.scene, l.camera);});
      blend.uniforms.uA.value = targets.layers[0].texture; blend.uniforms.uB.value = targets.layers[1].texture;
      pass(blend, targets.hdr);
      // The motif overlay lands on the blended frame, so it carries across every transition.
      gl.autoClear = false; gl.setRenderTarget(targets.hdr); gl.render(overlay.scene, overlay.camera); gl.autoClear = true;
      let source = targets.hdr;
      targets.downs.forEach((target, i) => {
        down.uniforms.uSrc.value = source.texture; down.uniforms.uTexel.value.set(1 / source.width, 1 / source.height);
        down.uniforms.uThreshold.value = i === 0 ? BLOOM_THRESHOLD : -1;
        pass(down, target); source = target;
      });
      for (let i = targets.ups.length - 1; i >= 0; i--) {
        up.uniforms.uSrc.value = source.texture; up.uniforms.uBase.value = targets.downs[i].texture;
        up.uniforms.uTexel.value.set(1 / source.width, 1 / source.height);
        pass(up, targets.ups[i]); source = targets.ups[i];
      }
      composite.uniforms.uBloom.value = source.texture;
      pass(composite, null);
    },
    dispose() {targets.dispose(); geometry.dispose(); [blend, down, up, composite].forEach(m => m.dispose());},
  };
}

function applyPose(camera: THREE.PerspectiveCamera, pose: CameraPose) {
  camera.position.set(...pose.position); camera.up.set(0, 1, 0);
  camera.lookAt(...pose.target); camera.rotateZ(pose.roll);
  camera.fov = pose.fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
}
const slotFor = (slots: Map<SceneId, Slot>, id: SceneId) => {
  let slot = slots.get(id);
  if (!slot) slots.set(id, slot = {scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(45, 1, .05, 200)});
  return slot;
};

/**
 * Renders each active scene into its own HDR layer, blends them with the incoming scene's transition,
 * overlays the motif layer, then bloom + ACES + grain to the canvas. The only useFrame in v3: all
 * per-frame state arrives as props and is applied in layout effects before Remotion's manual advance.
 * Every portal gets the static World through WorldContext (portals do not inherit context from outside the canvas).
 */
export const Compositor = ({state, world}: {state: FrameState; world: World}) => {
  const gl = useThree(s => s.gl);
  const pipe = useMemo(() => createPipeline(gl), [gl]);
  useEffect(() => () => pipe.dispose(), [pipe]);
  const slots = useMemo(() => new Map<SceneId, Slot>(), []);
  const motif = useMemo<Slot>(() => {
    const camera = new THREE.PerspectiveCamera(MOTIF_CAMERA.fov, 1, .1, 100);
    camera.position.set(0, 0, MOTIF_CAMERA.distance); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    return {scene: new THREE.Scene(), camera};
  }, []);
  const layers = state.layers.map(l => ({...l, slot: slotFor(slots, l.scene.id)}));
  useLayoutEffect(() => {layers.forEach(l => applyPose(l.slot.camera, l.camera)); pipe.update(state);}, [state]);
  useFrame(() => pipe.render(layers.map(l => l.slot), motif), 1);
  // Keyed by scene id, so the incoming scene keeps its instance when it moves from slot 1 to slot 0.
  return <>
    {layers.map(l => {
      const {Component} = SCENES[l.scene.id];
      return <Fragment key={l.scene.id}>{createPortal(<WorldContext.Provider value={world}><Component {...l.props}/></WorldContext.Provider>, l.slot.scene)}</Fragment>;
    })}
    {createPortal(<WorldContext.Provider value={world}><MotifLayer state={state.motifs} t={state.world.held} light={state.post.light}/></WorldContext.Provider>, motif.scene)}
  </>;
};
