'use strict'

import * as twgl from 'twgl.js';
import { vec3 } from 'gl-matrix';

// Hack to be able to use twgl.drawBufferInfo() so that it behaves the same as
// gl.drawArrays(gl.TRIANGLES, 0, 3)
// where this setup sets bufferInfo.numElements to 3
const fullScreenQuadArrays = {
  position: { numComponents: 1, data: [0, 0, 0], },
};

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
 * Creates a geometry object compatible with the rendering pipeline
 * @param {*} gl WebGL rendering context
 * @param {*} shaderProgramInfo associated shader program
 * @param {*} volumeTexture volume data 3D texture
 * @param {*} dimensions dimensions of provided volume texture
 * @param {*} UIData object with UI-controlled variables
 * @param {*} camera object with camera-related uniforms
 * @returns geometry object of the volume for 3D volume rendering
 */
export function createVolumeGeometry(gl, shaderProgramInfo, volumeTexture, dimensions, UIData, camera)
{
  const fullScreenQuadBufferInfo = twgl.createBufferInfoFromArrays(gl, fullScreenQuadArrays);
  const emptyVAO = twgl.createVAOFromBufferInfo(gl, shaderProgramInfo, fullScreenQuadBufferInfo);
  let bbox_dimensions = vec3.create();
  vec3.set(bbox_dimensions, 5, 5, 5);

  return {
    bufferInfo: fullScreenQuadBufferInfo, 
    vao: emptyVAO, 
    programInfo: shaderProgramInfo, 
    uniforms: {
      u_volume_texture: volumeTexture,
      u_bbox_dimensions: bbox_dimensions,
      u_eye_position: camera.u_eye_position,
      u_view_inv: camera.u_view_inv,
      u_projection_inv: camera.u_projection_inv,
    }
  };
}

/**
 * Creates a simple debug triangle
 * @param {*} gl WebGL rendering context
 * @param {*} shaderProgramInfo associated shader program
 * @returns geometry object of the triangle
 */
export function createTriangleGeometry(gl, shaderProgramInfo)
{
  const triangleArrays = {
     position: { numComponents: 2, data: [-0.5, 0, 0, 0.866, 0.3, 0], },
  };

  const triangleBufferInfo = twgl.createBufferInfoFromArrays(gl, triangleArrays);
  const triangleVAO = twgl.createVAOFromBufferInfo(gl, shaderProgramInfo, triangleBufferInfo);

  return {
    bufferInfo: triangleBufferInfo, 
    vao: triangleVAO, 
    programInfo: shaderProgramInfo, 
    uniforms: null
  };
}
