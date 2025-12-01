'use strict'

import * as twgl from 'twgl.js';
import { vec3 } from 'gl-matrix';

// Hack to be able to use twgl.drawBufferInfo() so that it behaves the same as
// gl.drawArrays(gl.TRIANGLES, 0, 3)
// where this setup sets bufferInfo.numElements to 3
const fullScreenQuadArrays = {
  position: { numComponents: 1, data: [0, 0, 0], },
};

export function createLoadingScreenGeometry(gl, shaderProgramInfo, texture)
{
  const fullScreenQuadBufferInfo = twgl.createBufferInfoFromArrays(gl, fullScreenQuadArrays);
  const emptyVAO = twgl.createVAOFromBufferInfo(gl, shaderProgramInfo, fullScreenQuadBufferInfo);

  return {
    bufferInfo: fullScreenQuadBufferInfo, 
    vao: emptyVAO, 
    programInfo: shaderProgramInfo, 
    uniforms: {
      u_texture: texture,
    }
  };
}

/**
 * Creates a geometry object compatible with the rendering pipeline
 * @param {*} gl WebGL rendering context
 * @param {*} shaderProgramInfo associated shader program
 * @param {*} volumeTexture volume data 3D texture
 * @param {*} dimensions dimensions of provided volume texture
 * @param {*} UIData object with UI-controlled variables
 * @returns geometry object of the volume for individual slice rendering
 */
export function createSliceGeometry(gl, shaderProgramInfo, volumeTexture, dimensions, UIData)
{
  const fullScreenQuadBufferInfo = twgl.createBufferInfoFromArrays(gl, fullScreenQuadArrays);
  const emptyVAO = twgl.createVAOFromBufferInfo(gl, shaderProgramInfo, fullScreenQuadBufferInfo);

  return {
    bufferInfo: fullScreenQuadBufferInfo, 
    vao: emptyVAO, 
    programInfo: shaderProgramInfo, 
    uniforms: {
      u_volume_texture: volumeTexture,
      u_slice_number: UIData.slice,
      u_slice_count: dimensions.depth,
    }
  };
}

/**
 * Creates an object that can be mapped by twgl.js to a Uniform Block on the GPU
 * @param {*} UIData object with UI-controlled variables
 * @returns object with the same exact structure as defined in the shader
 */
function getTransferFunctionfromUIData(UIData)
{
  let tf = { 
    media_array: []
  };

  for (const key in UIData.transferFunction)
  {
    const medium = UIData.transferFunction[key];

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
 * Creates a geometry object compatible with the rendering pipeline
 * @param {*} gl WebGL rendering context
 * @param {*} shaderProgramInfo associated shader program
 * @param {*} volumeTexture volume data 3D texture
 * @param {*} dimensions dimensions of provided volume texture
 * @param {*} UIData object with UI-controlled variables
 * @param {*} camera object with camera-related uniforms
 * @returns geometry object of the volume for 3D volume rendering
 */
export function createVolumeGeometry(gl, shaderProgramInfo, volumeTexture, dimensions, UIData)
{
  const fullScreenQuadBufferInfo = twgl.createBufferInfoFromArrays(gl, fullScreenQuadArrays);
  const emptyVAO = twgl.createVAOFromBufferInfo(gl, shaderProgramInfo, fullScreenQuadBufferInfo);
  const bbox_min = vec3.fromValues(-1, -1, -1);
  const bbox_max = vec3.fromValues(1, 1, 1);

  return {
    bufferInfo: fullScreenQuadBufferInfo, 
    vao: emptyVAO, 
    programInfo: shaderProgramInfo, 
    uniforms: {
      // Volume Data
      u_volume_texture: volumeTexture,
      u_bbox_min: bbox_min,
      u_bbox_max: bbox_max,
    },
    // Transfer Function
    uniformBlock: {
      info: twgl.createUniformBlockInfo(gl, shaderProgramInfo, "TransferFunction"),
      uniforms: getTransferFunctionfromUIData(UIData),
    },
  };
}

/**
 * Creates a simple debug sphere
 * @param {*} gl WebGL rendering context
 * @param {*} shaderProgramInfo associated shader program
 * @returns geometry object of the sphere
 */
export function createSphereGeometry(gl, shaderProgramInfo, UIData)
{
  const fullScreenQuadBufferInfo = twgl.createBufferInfoFromArrays(gl, fullScreenQuadArrays);
  const emptyVAO = twgl.createVAOFromBufferInfo(gl, shaderProgramInfo, fullScreenQuadBufferInfo);

  return {
    bufferInfo: fullScreenQuadBufferInfo, 
    vao: emptyVAO, 
    programInfo: shaderProgramInfo, 
    // Transfer Function
    uniformBlock: {
      info: twgl.createUniformBlockInfo(gl, shaderProgramInfo, "TransferFunction"),
      uniforms: getTransferFunctionfromUIData(UIData),
    },
  };
}
