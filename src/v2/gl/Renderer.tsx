import {useLayoutEffect, useRef} from 'react';
import {createProgram, createTarget} from './program';
import type {Program, Target} from './program';
import {SCENE} from './shaders/scene.glsl';
import {COMPOSITE, DOWN, UP} from '../../shared/glsl/bloom';
import type {FrameUniforms} from './uniforms';

const SIZE = 1080, BLOOM_LEVELS = 5, BLOOM_THRESHOLD = .55;
type State = {
  gl: WebGL2RenderingContext; scene: Program; down: Program; up: Program; composite: Program;
  sceneTarget: Target; downs: Target[]; ups: Target[];
};

function init(canvas: HTMLCanvasElement): State {
  // preserveDrawingBuffer lets Remotion capture the canvas after the draw call.
  const gl = canvas.getContext('webgl2', {preserveDrawingBuffer: true, antialias: false});
  if (!gl) throw new Error('WebGL2 unavailable');
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const downs: Target[] = [];
  for (let i = 0, size = SIZE; i < BLOOM_LEVELS; i++) {size = Math.ceil(size / 2); downs.push(createTarget(gl, size, size));}
  return {
    gl, scene: createProgram(gl, SCENE), down: createProgram(gl, DOWN), up: createProgram(gl, UP), composite: createProgram(gl, COMPOSITE),
    sceneTarget: createTarget(gl, SIZE, SIZE), downs, ups: downs.slice(0, -1).map(d => createTarget(gl, d.width, d.height)),
  };
}

function draw(s: State, u: FrameUniforms) {
  const {gl} = s;
  const pass = (program: Program, target: Target | null, textures: Record<string, WebGLTexture> = {}) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
    gl.viewport(0, 0, target?.width ?? SIZE, target?.height ?? SIZE);
    gl.useProgram(program.program);
    Object.entries(textures).forEach(([name, texture], unit) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(program.uniform(name), unit);
    });
    if (target) gl.uniform2f(program.uniform('uDst'), target.width, target.height);
  };
  const run = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

  pass(s.scene, s.sceneTarget);
  gl.uniform2f(s.scene.uniform('uRes'), SIZE, SIZE);
  for (const [name, value] of Object.entries(u.scene)) gl.uniform1f(s.scene.uniform(name), value);
  gl.uniform1i(s.scene.uniform('uNoteCount'), u.noteCount);
  gl.uniform4fv(s.scene.uniform('uNotes'), u.notes);
  gl.uniform1fv(s.scene.uniform('uNoteHue'), u.noteHue);
  run();

  let source = s.sceneTarget;
  s.downs.forEach((target, i) => {
    pass(s.down, target, {uSrc: source.texture});
    gl.uniform2f(s.down.uniform('uTexel'), 1 / source.width, 1 / source.height);
    gl.uniform1f(s.down.uniform('uThreshold'), i === 0 ? BLOOM_THRESHOLD : -1);
    run();
    source = target;
  });
  for (let i = s.ups.length - 1; i >= 0; i--) {
    pass(s.up, s.ups[i], {uSrc: source.texture, uBase: s.downs[i].texture});
    gl.uniform2f(s.up.uniform('uTexel'), 1 / source.width, 1 / source.height);
    run();
    source = s.ups[i];
  }

  pass(s.composite, null, {uScene: s.sceneTarget.texture, uBloom: source.texture});
  gl.uniform2f(s.composite.uniform('uRes'), SIZE, SIZE);
  for (const [name, value] of Object.entries(u.post)) gl.uniform1f(s.composite.uniform(name), value);
  run();
}

export const Renderer = ({uniforms}: {uniforms: FrameUniforms}) => {
  const canvas = useRef<HTMLCanvasElement>(null), state = useRef<State | null>(null);
  useLayoutEffect(() => {
    state.current ??= init(canvas.current!);
    draw(state.current, uniforms);
  }, [uniforms]);
  return <canvas ref={canvas} width={SIZE} height={SIZE} style={{position: 'absolute', inset: 0, width: '100%', height: '100%'}}/>;
};
