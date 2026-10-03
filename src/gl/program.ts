export const VERTEX = `#version 300 es
in vec2 aPos;
void main() {gl_Position = vec4(aPos, 0., 1.);}`;

export type Program = {program: WebGLProgram; uniform: (name: string) => WebGLUniformLocation | null};
export type Target = {framebuffer: WebGLFramebuffer; texture: WebGLTexture; width: number; height: number};

export function createProgram(gl: WebGL2RenderingContext, fragment: string): Program {
  const program = gl.createProgram()!;
  for (const [type, source] of [[gl.VERTEX_SHADER, VERTEX], [gl.FRAGMENT_SHADER, fragment]] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(`Shader compile failed: ${gl.getShaderInfoLog(shader)}`);
    gl.attachShader(program, shader);
  }
  gl.bindAttribLocation(program, 0, 'aPos');
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(`Program link failed: ${gl.getProgramInfoLog(program)}`);
  const locations = new Map<string, WebGLUniformLocation | null>();
  return {program, uniform: name => {
    if (!locations.has(name)) locations.set(name, gl.getUniformLocation(program, name));
    return locations.get(name)!;
  }};
}

/** Render target; half-float when the context can render to it, so glow can exceed 1 before tonemapping. */
export function createTarget(gl: WebGL2RenderingContext, width: number, height: number): Target {
  const hdr = gl.getExtension('EXT_color_buffer_float') !== null;
  const texture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, hdr ? gl.RGBA16F : gl.RGBA8, width, height, 0, gl.RGBA, hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const framebuffer = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Incomplete render target');
  return {framebuffer, texture, width, height};
}
