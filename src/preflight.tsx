import {useLayoutEffect, useMemo, useRef} from 'react';
import {Composition, Folder, getRemotionEnvironment, registerRoot, useCurrentFrame} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {FULLSCREEN} from './v3/render/shaders/transition.glsl';
import {fullscreenTriangle, hdrTarget, LAYER_SAMPLES} from './v3/render/targets';

// Minimal WebGL2 frame: proves headless GL capture works before scene work.
const vertex = `#version 300 es
in vec2 p; void main() {gl_Position = vec4(p, 0., 1.);}`;
const fragment = `#version 300 es
precision highp float; uniform float t; out vec4 o;
void main() {
  vec2 uv = (gl_FragCoord.xy - 540.) / 540.;
  float d = abs(abs(uv.x) + abs(uv.y) - .45 - .05 * sin(t * 6.283));
  o = vec4(vec3(.21, .9, 1.) * .012 / max(d, .002), 1.);
}`;
const Frame = () => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  useLayoutEffect(() => {
    const gl = ref.current?.getContext('webgl2', {preserveDrawingBuffer: true});
    if (!gl) throw new Error('WebGL2 unavailable');
    const program = gl.createProgram()!;
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'compile');
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program); gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1f(gl.getUniformLocation(program, 't'), frame / 60);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }, [frame]);
  return <canvas ref={ref} width={1080} height={1080} style={{background: '#060814'}}/>;
};

// R3F path used by v3: an HDR (half-float, multisampled) scene layer resolved through one fullscreen pass.
const Pass = ({frame}: {frame: number}) => {
  const gl = useThree(s => s.gl);
  const pipe = useMemo(() => {
    if (!gl.getContext().getExtension('EXT_color_buffer_float') && getRemotionEnvironment().isRendering) throw new Error('EXT_color_buffer_float unavailable');
    const target = hdrTarget(1080, {depth: true, samples: LAYER_SAMPLES}), scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(40, 1, .1, 50);
    const knot = new THREE.Mesh(new THREE.TorusKnotGeometry(1, .3, 128, 16), new THREE.MeshBasicMaterial({color: new THREE.Color(4, 1.2, .2)}));
    scene.add(knot); camera.position.set(0, 0, 6);
    const material = new THREE.RawShaderMaterial({glslVersion: THREE.GLSL3, uniforms: {uSrc: {value: target.texture}}, vertexShader: FULLSCREEN,
      fragmentShader: 'precision highp float; in vec2 vUv; out vec4 o; uniform sampler2D uSrc; void main() {vec3 c = texture(uSrc, vUv).rgb; o = vec4(pow(c / (1. + c), vec3(1. / 2.2)), 1.);}'});
    const quad = new THREE.Mesh(fullscreenTriangle(), material), quadScene = new THREE.Scene();
    quad.frustumCulled = false; quadScene.add(quad);
    return {knot, render() {gl.setRenderTarget(target); gl.render(scene, camera); gl.setRenderTarget(null); gl.render(quadScene, camera);}};
  }, [gl]);
  useLayoutEffect(() => {pipe.knot.rotation.set(frame * .05, frame * .03, 0);}, [pipe, frame]);
  useFrame(() => pipe.render(), 1);
  return null;
};
const Three = () => {
  const frame = useCurrentFrame();
  return <ThreeCanvas width={1080} height={1080} dpr={1} flat gl={{preserveDrawingBuffer: true, antialias: false, alpha: false}}><Pass frame={frame}/></ThreeCanvas>;
};

registerRoot(() => <Folder name="Preflight">
  <Composition id="Preflight" component={Frame} durationInFrames={60} fps={60} width={1080} height={1080}/>
  <Composition id="PreflightThree" component={Three} durationInFrames={60} fps={60} width={1080} height={1080}/>
</Folder>);
