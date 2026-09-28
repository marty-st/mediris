'use strict';

import { createReferencePrimitives } from "../app/helper";
import { setWorldPositionFromCameraSpace } from "./math";

/**
 * Creates a transfer function object that can be mapped by twgl.js to a Uniform Block on the GPU.
 * @param {*} appData object with application data - settings, environment, etc.
 * @returns transfer function object with the same exact structure as defined in the shader
 */
function createTransferFunctionUniformBlock(mediumTF)
{
  return {
    color: mediumTF.colorVec,
    interval: mediumTF.intervalVec,
  };
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
 * @param {*} environment object with environment data - lights, camera, scene, etc.
 * @param {*} cameraInvViewMat camera inverse view matrix
 * @returns object containing an array with per-light data and the array size
 */
function createLightsUniformBlock(lightsArray)
{
  let lights_array = [];

  for (const light of lightsArray)
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

    lights_array.push(l);
  }

  return lights_array;
}

function createShadingUniformBlock(shadingArray, mediumShading)
{
  for (const shading of mediumShading)
  {
    const shadingElement = {
      params: createReferencePrimitives({}, ...Object.entries(Object.assign({}, ...Object.values(shading.parameters)))),
      lights: createLightsUniformBlock(shading.lights),
      // lights_array_size: shading.lights.length,
      model: undefined,
      enabled: undefined,
    };

    shadingElement.lights_array_size = shadingElement.lights.length;

    createReferencePrimitives(shadingElement, ["model", shading.model]);
    createReferencePrimitives(shadingElement, ["enabled", shading.enabled]);

    shadingArray.push(shadingElement);
  }
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
export function createVolumeMediaUniformBlock(volumeMedia)
{
  let vm = {
    media_array: [],
    media_array_size: 0,
  };

  for (const medium of Object.values(volumeMedia))
  {
    const volumeMedium = {
      tf: createTransferFunctionUniformBlock(medium.transferFunction),
      shd: [],
      shading_array_size: medium.shading.length,
      channel: medium.channel === "ct" ? 0 : 1,
      enabled: undefined,
    };

    createReferencePrimitives(volumeMedium, ["enabled", medium.enabled]);
    createShadingUniformBlock(volumeMedium.shd, medium.shading);

    vm.media_array.push(volumeMedium);
  }

  vm.media_array_size = vm.media_array.length;

  return vm;
}
