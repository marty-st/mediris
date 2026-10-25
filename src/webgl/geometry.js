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
import {
  createLightsUniformBlock,
  createShadingParametersUniformBlock,
  createShadingUniformBlock,
  createTransferFunctionUniformBlock,
  createVolumeMediaUniformBlock
} from './uniform';
import { flattenVolumeMedia } from '../app/helper';

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
    draws: [
      {
        frameBuffer: null,
        drawBuffers: [gl.BACK],
        bufferInfo: fullScreenQuadBufferInfo,
        vao: emptyVAO,
        programInfo: shaderProgramInfo,
        shaderFileNames: shaderFileNames,
        uniforms: {
          u_texture: texture,
        },
      },
    ],
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
export function createVolumeGeometry(gl, drawInfo, volumeMedia)
{
  const fullScreenQuadBufferInfo = twgl.createBufferInfoFromArrays(gl, fullScreenQuadArrays);
  const emptyVAO = twgl.createVAOFromBufferInfo(gl, drawInfo.raytraceShell.shaderProgramInfo, fullScreenQuadBufferInfo);
  const bbox_min = vec3.fromValues(-1, -1, -1);
  const bbox_max = vec3.fromValues(1, 1, 1);

  const flatVolumeMedia = flattenVolumeMedia(volumeMedia);

  return {
    draws: [
      { // Raytrace PET
        frameBuffer: drawInfo.raytracePET.frameBuffer,
        drawBuffers: [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1],
        bufferInfo: fullScreenQuadBufferInfo,
        vao: emptyVAO,
        programInfo: drawInfo.raytracePET.shaderProgramInfo,
        shaderFileNames: drawInfo.raytracePET.shaderFileNames,
        uniforms: {
          u_volume_texture: drawInfo.raytracePET.textureUniforms.volumeTexturePET,
          u_end_sample_point_texture: null,
          u_bbox_min: bbox_min,
          u_bbox_max: bbox_max,
          u_vm_index: 1,
          u_use_early_stop_texture: false,
        },
        uniformBlocks: [
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.raytracePET.shaderProgramInfo, "TransferFunction"),
            uniforms: createTransferFunctionUniformBlock(flatVolumeMedia.tf),
          },
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.raytracePET.shaderProgramInfo, "VolumeMedia"),
            uniforms: createVolumeMediaUniformBlock(flatVolumeMedia.vm, flatVolumeMedia.shd, flatVolumeMedia.tf),
          },
        ],
      },
      { // Shade PET
        frameBuffer: drawInfo.shadePET.frameBuffer,
        drawBuffers: [gl.COLOR_ATTACHMENT0],
        bufferInfo: fullScreenQuadBufferInfo,
        vao: emptyVAO,
        programInfo: drawInfo.shadePET.shaderProgramInfo,
        shaderFileNames: drawInfo.shadePET.shaderFileNames,
        uniforms: {
          u_volume_texture: drawInfo.shadePET.textureUniforms.volumeTexturePET,
          u_sample_point_texture: drawInfo.shadePET.textureUniforms.samplePointTexturePET,
          u_vm_index: 1,
        },
        uniformBlocks: [
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.shadePET.shaderProgramInfo, "TransferFunction"),
            uniforms: createTransferFunctionUniformBlock(flatVolumeMedia.tf),
          },
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.shadePET.shaderProgramInfo, "Lights"),
            uniforms: createLightsUniformBlock(flatVolumeMedia.lights),
          },
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.shadePET.shaderProgramInfo, "ShadingParameters"),
            uniforms: createShadingParametersUniformBlock(flatVolumeMedia.params),
          },
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.shadePET.shaderProgramInfo, "Shadings"),
            uniforms: createShadingUniformBlock(flatVolumeMedia.shd, flatVolumeMedia.params, flatVolumeMedia.lights),
          },
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.shadePET.shaderProgramInfo, "VolumeMedia"),
            uniforms: createVolumeMediaUniformBlock(flatVolumeMedia.vm, flatVolumeMedia.shd, flatVolumeMedia.tf),
          },
        ],
      },
      { // Raytrace Shell
        frameBuffer: drawInfo.raytraceShell.frameBuffer,
        drawBuffers: [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1],
        bufferInfo: fullScreenQuadBufferInfo,
        vao: emptyVAO,
        programInfo: drawInfo.raytraceShell.shaderProgramInfo,
        shaderFileNames: drawInfo.raytraceShell.shaderFileNames,
        uniforms: {
          u_volume_texture: drawInfo.raytraceShell.textureUniforms.volumeTextureShell,
          u_end_sample_point_texture: drawInfo.raytraceShell.textureUniforms.samplePointTexturePET,
          u_bbox_min: bbox_min,
          u_bbox_max: bbox_max,
          u_vm_index: 0,
          u_use_early_stop_texture: true,
        },
        uniformBlocks: [
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.raytraceShell.shaderProgramInfo, "TransferFunction"),
            uniforms: createTransferFunctionUniformBlock(flatVolumeMedia.tf),
          },
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.raytraceShell.shaderProgramInfo, "VolumeMedia"),
            uniforms: createVolumeMediaUniformBlock(flatVolumeMedia.vm, flatVolumeMedia.shd, flatVolumeMedia.tf),
          },
        ],
      },
      { // Shade Shell
        frameBuffer: drawInfo.shadeShell.frameBuffer,
        drawBuffers: [gl.COLOR_ATTACHMENT0],
        bufferInfo: fullScreenQuadBufferInfo,
        vao: emptyVAO,
        programInfo: drawInfo.shadeShell.shaderProgramInfo,
        shaderFileNames: drawInfo.shadeShell.shaderFileNames,
        uniforms: {
          u_volume_texture: drawInfo.shadeShell.textureUniforms.volumeTextureShell,
          u_sample_point_texture: drawInfo.shadeShell.textureUniforms.samplePointTextureShell,
          u_vm_index: 0,
        },
        uniformBlocks: [
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.shadeShell.shaderProgramInfo, "TransferFunction"),
            uniforms: createTransferFunctionUniformBlock(flatVolumeMedia.tf),
          },
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.shadeShell.shaderProgramInfo, "Lights"),
            uniforms: createLightsUniformBlock(flatVolumeMedia.lights),
          },
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.shadeShell.shaderProgramInfo, "ShadingParameters"),
            uniforms: createShadingParametersUniformBlock(flatVolumeMedia.params),
          },
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.shadeShell.shaderProgramInfo, "Shadings"),
            uniforms: createShadingUniformBlock(flatVolumeMedia.shd, flatVolumeMedia.params, flatVolumeMedia.lights),
          },
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.shadeShell.shaderProgramInfo, "VolumeMedia"),
            uniforms: createVolumeMediaUniformBlock(flatVolumeMedia.vm, flatVolumeMedia.shd, flatVolumeMedia.tf),
          },
        ],
      },
      { // Raytrace Bone
        frameBuffer: drawInfo.raytraceBone.frameBuffer,
        drawBuffers: [gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1],
        bufferInfo: fullScreenQuadBufferInfo,
        vao: emptyVAO,
        programInfo: drawInfo.raytraceBone.shaderProgramInfo,
        shaderFileNames: drawInfo.raytraceBone.shaderFileNames,
        uniforms: {
          u_volume_texture: drawInfo.raytraceBone.textureUniforms.volumeTextureBone,
          u_end_sample_point_texture: drawInfo.raytraceBone.textureUniforms.samplePointTexturePET,
          u_bbox_min: bbox_min,
          u_bbox_max: bbox_max,
          u_vm_index: 2,
          u_use_early_stop_texture: true,
        },
        uniformBlocks: [
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.raytraceBone.shaderProgramInfo, "TransferFunction"),
            uniforms: createTransferFunctionUniformBlock(flatVolumeMedia.tf),
          },
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.raytraceBone.shaderProgramInfo, "VolumeMedia"),
            uniforms: createVolumeMediaUniformBlock(flatVolumeMedia.vm, flatVolumeMedia.shd, flatVolumeMedia.tf),
          },
        ],
      },
      { // Shade Bone
        frameBuffer: drawInfo.shadeBone.frameBuffer,
        drawBuffers: [gl.COLOR_ATTACHMENT0],
        bufferInfo: fullScreenQuadBufferInfo,
        vao: emptyVAO,
        programInfo: drawInfo.shadeBone.shaderProgramInfo,
        shaderFileNames: drawInfo.shadeBone.shaderFileNames,
        uniforms: {
          u_volume_texture: drawInfo.shadeBone.textureUniforms.volumeTextureBone,
          u_sample_point_texture: drawInfo.shadeBone.textureUniforms.samplePointTextureBone,
          u_vm_index: 2,
        },
        uniformBlocks: [
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.shadeBone.shaderProgramInfo, "TransferFunction"),
            uniforms: createTransferFunctionUniformBlock(flatVolumeMedia.tf),
          },
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.shadeBone.shaderProgramInfo, "Lights"),
            uniforms: createLightsUniformBlock(flatVolumeMedia.lights),
          },
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.shadeBone.shaderProgramInfo, "ShadingParameters"),
            uniforms: createShadingParametersUniformBlock(flatVolumeMedia.params),
          },
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.shadeBone.shaderProgramInfo, "Shadings"),
            uniforms: createShadingUniformBlock(flatVolumeMedia.shd, flatVolumeMedia.params, flatVolumeMedia.lights),
          },
          {
            info: twgl.createUniformBlockInfo(gl, drawInfo.shadeBone.shaderProgramInfo, "VolumeMedia"),
            uniforms: createVolumeMediaUniformBlock(flatVolumeMedia.vm, flatVolumeMedia.shd, flatVolumeMedia.tf),
          },
        ],
      },
      { // Blend
        frameBuffer: drawInfo.blend.frameBuffer,
        drawBuffers: [gl.COLOR_ATTACHMENT0],
        bufferInfo: fullScreenQuadBufferInfo,
        vao: emptyVAO,
        programInfo: drawInfo.blend.shaderProgramInfo,
        shaderFileNames: drawInfo.blend.shaderFileNames,
        uniforms: {
          u_texture_shell: drawInfo.blend.textureUniforms.colorTextureShell,
          u_texture_pet: drawInfo.blend.textureUniforms.colorTexturePET,
          u_texture_bone: drawInfo.blend.textureUniforms.colorTextureBone,
        },
      },
    ],
  };
}
