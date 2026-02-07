'use strict'

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

/* GLOBAL VARIABLES */

// Hack to be able to use twgl.drawBufferInfo() so that it behaves the same as
// gl.drawArrays(gl.TRIANGLES, 0, 3)
// where this setup sets bufferInfo.numElements to 3
const fullScreenQuadArrays = {
  position: { numComponents: 1, data: [0, 0, 0], },
};

/**/

/**
 * Creates a geometry object compatible with the rendering pipeline.
 * @param {*} gl WebGL rendering context
 * @param {*} shaderProgramInfo associated shader program
 * @param {*} shaderFileNames contains file names of associated shaders for reload purposes
 * @param {*} texture image shown on the screen when loading screen is displayed
 * @returns geometry of the loading screen (full screen quad with a texture)
 */
export function createLoadingScreenGeometry(gl, shaderProgramInfo, shaderFileNames, texture)
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
    }
  };
}

/**
 * Creates a geometry object compatible with the rendering pipeline.
 * @param {*} gl WebGL rendering context
 * @param {*} shaderProgramInfo associated shader program
 * @param {*} shaderFileNames contains file names of associated shaders for reload purposes
 * @param {*} volumeTexture volume data 3D texture
 * @param {*} dimensions dimensions of provided volume texture
 * @param {*} GUIData mediator object between GUI and the rest of the application
 * @returns geometry object of the volume for individual slice rendering
 */
export function createSliceGeometry(gl, shaderProgramInfo, volumeTexture, dimensions, GUIData)
{
  const fullScreenQuadBufferInfo = twgl.createBufferInfoFromArrays(gl, fullScreenQuadArrays);
  const emptyVAO = twgl.createVAOFromBufferInfo(gl, shaderProgramInfo, fullScreenQuadBufferInfo);

  return {
    bufferInfo: fullScreenQuadBufferInfo, 
    vao: emptyVAO, 
    programInfo: shaderProgramInfo, 
    uniforms: {
      u_volume_texture: volumeTexture,
      u_slice_number: GUIData.slice,
      u_slice_count: dimensions.depth,
    }
  };
}

/**
 * Creates a transfer function object that can be mapped by twgl.js to a Uniform Block on the GPU.
 * @param {*} GUIData mediator object between GUI and the rest of the application
 * @returns transfer function object with the same exact structure as defined in the shader
 */
function getTransferFunctionfromGUIData(GUIData)
{
  let tf = { 
    media_array: [],
    media_array_size: 0
  };

  for (const key in GUIData.transferFunction)
  {
    const medium = GUIData.transferFunction[key];

    if (!medium.enabled)
      continue;

    tf.media_array.push({
      color: medium.colorVec,
      interval: medium.intervalVec,
    })
  }

  tf.media_array_size = tf.media_array.length;

  return tf;
}

/**
 * Creates a geometry object compatible with the rendering pipeline.
 * @param {*} gl WebGL rendering context
 * @param {*} shaderProgramInfo associated shader program
 * @param {*} shaderFileNames contains file names of associated shaders for reload purposes
 * @param {*} volumeTexture volume data 3D texture
 * @param {*} dimensions dimensions of provided volume texture
 * @param {*} GUIData mediator object between GUI and the rest of the application
 * @param {*} camera object with camera-related uniforms
 * @returns geometry object of the volume for 3D volume rendering
 */
export function createVolumeGeometry(gl, shaderProgramInfo, shaderFileNames, volumeTexture, dimensions, GUIData)
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
    // Transfer Function
    uniformBlock: {
      info: twgl.createUniformBlockInfo(gl, shaderProgramInfo, "TransferFunction"),
      uniforms: getTransferFunctionfromGUIData(GUIData),
    },
  };
}

/**
 * Creates a simple debug sphere.
 * @param {*} gl WebGL rendering context
 * @param {*} shaderProgramInfo associated shader program
 * @returns geometry object of the sphere
 */
export function createSphereGeometry(gl, shaderProgramInfo, shaderFileNames, GUIData)
{
  const fullScreenQuadBufferInfo = twgl.createBufferInfoFromArrays(gl, fullScreenQuadArrays);
  const emptyVAO = twgl.createVAOFromBufferInfo(gl, shaderProgramInfo, fullScreenQuadBufferInfo);

  return {
    bufferInfo: fullScreenQuadBufferInfo, 
    vao: emptyVAO, 
    programInfo: shaderProgramInfo,
    shaderFileNames: shaderFileNames,
    // Transfer Function
    uniformBlock: {
      info: twgl.createUniformBlockInfo(gl, shaderProgramInfo, "TransferFunction"),
      uniforms: getTransferFunctionfromGUIData(GUIData),
    },
  };
}
