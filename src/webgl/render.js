'use strict'

import * as twgl from 'twgl.js';

/**
 * Main render function. Iteratively renders provided geometries.
 * @param {*} gl WebGL rendering context
 * @param {*} canvas HTML canvas element
 * @param {*} viewport object containing width and height, and leftX and bottomY attributes
 * @param {*} scene object with scene settings, i.e. lights, camera, shading uniforms.
 * @param {*} geometries Array of `geometry` objects
 */
export default function render(gl, canvas, viewport, scene, geometries)
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

    // Scene uniforms & UBOs
    if (scene.uniforms)
      twgl.setUniforms(geometry.programInfo, scene.uniforms)
    
    if (scene.uniformBlock)
    {
      twgl.setBlockUniforms(scene.uniformBlock.info, scene.uniformBlock.uniforms);
      twgl.setUniformBlock(gl, geometry.programInfo, scene.uniformBlock.info);
    }

    // Geometry uniforms & UBOs
    if (geometry.uniforms)
      twgl.setUniforms(geometry.programInfo, geometry.uniforms);

    if (geometry.uniformBlock)
    {
      twgl.setBlockUniforms(geometry.uniformBlock.info, geometry.uniformBlock.uniforms);
      twgl.setUniformBlock(gl, geometry.programInfo, geometry.uniformBlock.info);
    }

    twgl.drawBufferInfo(gl, geometry.bufferInfo);
  }

  gl.bindVertexArray(null);
}
