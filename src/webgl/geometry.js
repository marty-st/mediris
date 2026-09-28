'use strict';

/**
 * FUNCTIONALITY OVERVIEW
 *
 * Geometry objects are objects that are taken into the rendering loop
 * where they provide all necessary information needed for their correct rendering.
 *
 * This includes a linked shader program, buffer with geometry data, Vertex Array Object,
 * uniforms (this includes textures), and Uniform Blocks (UBOs).
 *
 * Geometry objects are also used to render full-screen quads intended for ray-casting,
 * deffered rendering, or post-processing.
 *
 * ----------------------
 */

import * as twgl from 'twgl.js';
import { vec3 } from 'gl-matrix';
import { createVolumeMediaUniformBlock } from './uniform';

/* GLOBAL VARIABLES */

// Hack to be able to use twgl.drawBufferInfo() so that it behaves the same as
// gl.drawArrays(gl.TRIANGLES, 0, 3)
// where this setup sets bufferInfo.numElements to 3
const fullScreenQuadArrays = {
  position: { numComponents: 1, data: [0, 0, 0] },
};

/**/

/**
 * Creates a geometry object compatible with the rendering pipeline.
 * @param {*} gl WebGL rendering context
 * @param {*} shaderProgramInfo associated shader program
 * @param {*} shaderFileNames contains file names of associated shaders for reload purposes
 * @param {*} texture texture rendered onto the full-screen quad
 * @returns full-screen geometry (full-screen quad with a texture)
 */
export function createFullScreenGeometry(gl, shaderProgramInfo, shaderFileNames, texture)
{
  const fullScreenQuadBufferInfo = twgl.createBufferInfoFromArrays(gl, fullScreenQuadArrays);
  const emptyVAO = twgl.createVAOFromBufferInfo(gl, shaderProgramInfo, fullScreenQuadBufferInfo);

  return {
    bufferInfo: fullScreenQuadBufferInfo,
    vao: emptyVAO,
    programInfo: shaderProgramInfo,
    shaderFileNames: shaderFileNames,
    uniforms: {
      u_texture: texture,
    },
  };
}

/**
 * Creates a geometry object compatible with the rendering pipeline.
 * @param {*} gl WebGL rendering context
 * @param {*} shaderProgramInfo associated shader program
 * @param {*} shaderFileNames contains file names of associated shaders for reload purposes
 * @param {*} volumeTexture volume data 3D texture
 * @param {*} dimensions dimensions of provided volume texture
 * @param {*} appData object with application data - settings, environment, etc.
 * @returns geometry object of the volume for individual slice rendering
 */
export function createSliceGeometry(gl, shaderProgramInfo, volumeTexture, dimensions, appData)
{
  const fullScreenQuadBufferInfo = twgl.createBufferInfoFromArrays(gl, fullScreenQuadArrays);
  const emptyVAO = twgl.createVAOFromBufferInfo(gl, shaderProgramInfo, fullScreenQuadBufferInfo);

  return {
    bufferInfo: fullScreenQuadBufferInfo,
    vao: emptyVAO,
    programInfo: shaderProgramInfo,
    uniforms: {
      u_volume_texture: volumeTexture,
      u_slice_number: appData.settings.slice,
      u_slice_count: dimensions.layers,
    },
  };
}

/**
 * Creates a geometry object compatible with the rendering pipeline.
 * @param {*} gl WebGL rendering context
 * @param {*} shaderProgramInfo associated shader program
 * @param {*} shaderFileNames contains file names of associated shaders for reload purposes
 * @param {*} volumeTexture volume data 3D texture
 * @param {*} transferFunction transfer function object from application data
 * @returns geometry object of the volume for 3D volume rendering
 */
export function createVolumeGeometry(gl, shaderProgramInfo, shaderFileNames, volumeTexture, volumeMedia)
{
  const fullScreenQuadBufferInfo = twgl.createBufferInfoFromArrays(gl, fullScreenQuadArrays);
  const emptyVAO = twgl.createVAOFromBufferInfo(gl, shaderProgramInfo, fullScreenQuadBufferInfo);
  const bbox_min = vec3.fromValues(-1, -1, -1);
  const bbox_max = vec3.fromValues(1, 1, 1);

  return {
    bufferInfo: fullScreenQuadBufferInfo,
    vao: emptyVAO,
    programInfo: shaderProgramInfo,
    shaderFileNames: shaderFileNames,
    uniforms: {
      // Volume Data
      u_volume_texture: volumeTexture,
      u_bbox_min: bbox_min,
      u_bbox_max: bbox_max,
    },
    // Volume Media, their Shading Model, and Transfer Function
    uniformBlock: {
      info: twgl.createUniformBlockInfo(gl, shaderProgramInfo, "VolumeMedia"),
      uniforms: createVolumeMediaUniformBlock(volumeMedia),
    },
  };
}

/**
 * Creates a simple debug sphere.
 * @param {*} gl WebGL rendering context
 * @param {*} shaderProgramInfo associated shader program
 * @param {*} shaderFileNames contains file names of associated shaders for reload purposes
 * @param {*} transferFunction transfer function object from application data
 * @returns geometry object of the sphere
 */
export function createSphereGeometry(gl, shaderProgramInfo, shaderFileNames, volumeMedia)
{
  const fullScreenQuadBufferInfo = twgl.createBufferInfoFromArrays(gl, fullScreenQuadArrays);
  const emptyVAO = twgl.createVAOFromBufferInfo(gl, shaderProgramInfo, fullScreenQuadBufferInfo);

  return {
    bufferInfo: fullScreenQuadBufferInfo,
    vao: emptyVAO,
    programInfo: shaderProgramInfo,
    shaderFileNames: shaderFileNames,
    // Volume Media, their Shading Model, and Transfer Function
    uniformBlock: {
      info: twgl.createUniformBlockInfo(gl, shaderProgramInfo, "VolumeMedia"),
      uniforms: createVolumeMediaUniformBlock(volumeMedia),
    },
  };
}
