'use strict';

import { createReferencePrimitives } from "../app/helper";
import { setWorldPositionFromCameraSpace } from "./math";

/**
 * Creates a transfer function object that can be mapped by twgl.js to a Uniform Block on the GPU.
 * @param {*} flatTransferFunction array of transfer function parameters for each medium
 * @returns transfer function object with the same exact structure as defined in the shader
 */
export function createTransferFunctionUniformBlock(flatTransferFunction)
{
  const tf = {
    array: [],
    array_size: 0,
  };

  for (const mediumTF of flatTransferFunction)
  {
    tf.array.push({
      color: mediumTF.colorVec,
      interval: mediumTF.intervalVec,
    });
  }

  tf.array_size = tf.array.length;

  return tf;
}

/**
 * Updates per-frame camera relative light positions.
 * @param {*} cameraRelativeLights array of camera relative light references
 * @param {*} camera WebGL camera object
 * TODO: To use this, create a reference to camera relative lights upon
 * light ubo creation and use that to update them.
 */
export function updateVolumeMediaLights(cameraRelativeLights, camera)
{
  for (const light of cameraRelativeLights)
  {
    setWorldPositionFromCameraSpace(light.position, camera.u_view_inv);
  }
}

/**
 * Transforms information about user-controlled light properties into a GPU compatible
 * format (UBO).
 * @param {*} flatLights array of all lights
 * @returns lights uniform buffer object (shader-compatible)
 */
export function createLightsUniformBlock(flatLights)
{
  const lights = {
    array: [],
  };

  for (const light of flatLights)
  {
    const l = {
      position: light.positionVec,
    };

    createReferencePrimitives(
      l,
      ["intensity", light.intensity],
      ["enabled", light.enabled],
      ["camera_relative", light.relativeToCamera]
    );

    lights.array.push(l);
  }

  return lights;
}

/**
 * Creates a GPU-compatible object containing an array of shading parameters.
 * @param {*} flatShadingParameters array of all shading parameters
 * @returns shading parameters uniform buffer object (shader-compatible)
 */
export function createShadingParametersUniformBlock(flatShadingParameters)
{
  const params = {
    array: [],
  };

  for (const parameters of flatShadingParameters)
  {
    params.array.push(createReferencePrimitives({}, ...Object.entries(Object.assign({}, ...Object.values(parameters)))));
  }

  return params;
}

/**
 * Creates a GPU-compatible object containing an array of shading information.
 * @param {*} flatShading array of all shading information
 * @param {*} flatShadingParameters array of all shading parameters
 * @param {*} flatLights array of all lights
 * @returns shading uniform buffer object (shader-compatible)
 */
export function createShadingUniformBlock(flatShading, flatShadingParameters, flatLights)
{
  const shd = {
    array: [],
  };

  for (const shading of flatShading)
  {
    const shadingElement = {
      params_index: flatShadingParameters.findIndex(fsp => shading.parameters === fsp),
      light_indices: shading.lights.map(l => flatLights.findIndex(fl => l === fl)),
      light_count: shading.lights.length,
      model: undefined,
      enabled: undefined,
    };

    createReferencePrimitives(shadingElement, ["model", shading.model]);
    createReferencePrimitives(shadingElement, ["enabled", shading.enabled]);

    shd.array.push(shadingElement);
  }

  return shd;
}

/**
 * Creates a uniform block sent to the GPU.
 * @param {*} volumeMedia CPU side representation of data
 * @returns twgl.js parsable object
 *
 * NOTE: For future optimization of the render pipeline, consider using static
 * and dynamic uniform buffers. Only the dynamic buffers will get uploaded each frame.
 * example:
  VolumeMediaStatic
    transfer functions
    shading parameters
    static light properties

  VolumeMediaDynamic
    dynamic light properties
    other frame-dependent values
 */
export function createVolumeMediaUniformBlock(flatVolumeMedia, flatShading, flatTransferFunction)
{
  const vm = {
    array: [],
    array_size: 0,
  };

  for (const medium of flatVolumeMedia)
  {
    const volumeMedium = {
      tf_index: flatTransferFunction.findIndex(ftf => medium.transferFunction === ftf),
      shd_indices: medium.shading.map(s => flatShading.findIndex(fs => s === fs)),
      shading_count: medium.shading.length,
      channel: medium.channel,
      enabled: undefined,
    };

    createReferencePrimitives(volumeMedium, ["enabled", medium.enabled]);

    vm.array.push(volumeMedium);
  }

  vm.array_size = vm.array.length;

  return vm;
}
