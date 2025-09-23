'use strict'

import * as twgl from 'twgl.js';

/**
 * Main render function
 * @param {*} gl WebGL rendering context
 * @param {*} canvas HTML canvas element
 * @param {*} geometries Array of `geometry` objects
 */
export default function render(gl, canvas, viewport, geometries)
{ 
  // TODO: canvas resize
  // https://webgl2fundamentals.org/webgl/lessons/webgl-resizing-the-canvas.html

  gl.viewport(viewport.leftX, viewport.bottomY, viewport.width, viewport.height);
  gl.scissor(viewport.leftX, viewport.bottomY, viewport.width, viewport.height);

  gl.clear(gl.COLOR_BUFFER_BIT);

  for (const geometry of geometries)
  {
    gl.useProgram(geometry.programInfo.program);
    gl.bindVertexArray(geometry.vao);

    if (geometry.uniforms)
      twgl.setUniforms(geometry.programInfo, geometry.uniforms);

    twgl.drawBufferInfo(gl, geometry.bufferInfo);
  }

  gl.bindVertexArray(null);
}
