import {useLayoutEffect, useRef} from 'react';
import {Composition, registerRoot, useCurrentFrame} from 'remotion';

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
registerRoot(() => <Composition id="Preflight" component={Frame} durationInFrames={60} fps={60} width={1080} height={1080}/>);
