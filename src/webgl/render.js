'use strict';

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
    for (const draw of geometry.draws)
    {
      gl.bindFramebuffer(gl.FRAMEBUFFER, draw.frameBuffer);
      gl.drawBuffers(draw.drawBuffers);
      // gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(draw.programInfo.program);
      gl.bindVertexArray(draw.vao);

      // Scene uniforms & UBOs
      if (scene.uniforms)
        twgl.setUniforms(draw.programInfo, scene.uniforms);

      if (scene.uniformBlock)
      {
        twgl.setBlockUniforms(scene.uniformBlock.info, scene.uniformBlock.uniforms);
        twgl.setUniformBlock(gl, draw.programInfo, scene.uniformBlock.info);
      }

      // Shader uniforms & UBOs
      if (draw.uniforms)
        twgl.setUniforms(draw.programInfo, draw.uniforms);

      if (draw.uniformBlocks)
      {
        for (const uniformBlock of draw.uniformBlocks)
        {
          twgl.setBlockUniforms(uniformBlock.info, uniformBlock.uniforms);
          twgl.setUniformBlock(gl, draw.programInfo, uniformBlock.info);
        }
      }

      twgl.drawBufferInfo(gl, draw.bufferInfo);
    }
  }

  gl.bindVertexArray(null);
}
