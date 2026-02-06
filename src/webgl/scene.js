'use strict'

import * as twgl from 'twgl.js';

/**
 * Creates an empty scene object compatible with the render loop.
 * @returns empty scene object used in the render loop.
 */
export function createSceneEmpty()
{
  return {
    uniforms: null,
  };
}

/**
 * Transforms information about user-controlled light properties into a GPU compatible
 * format (UBO). 
 * @param {*} UIData mediator object between UI and the rest of the application
 * @returns object containing an array with per-light data and the array size
 */
function createLightsUBOFromUIData(UIData)
{
  let lights = {
    lights_array: [],
    lights_array_size: 0
  };

  for (const key in UIData.lights)
  {
    const light = UIData.lights[key];

    lights.lights_array.push({
      position: light.positionVec,
      intensity: light.intensity,
    });
  }

  lights.lights_array_size = lights.lights_array.length;

  return lights;
}

/**
 * Creates a raycast scene object with uniform variables and uniform blocks used 
 * by a shader. These include raycasting properties, light sources, camera, shading
 * model properties.
 * @param {*} gl WebGL rendering context
 * @param {*} shaderProgramInfo associated shader program
 * @param {*} camera camera object
 * @param {*} UIData mediator object between UI and the rest of the application
 * @returns raycast scene object used in the render loop
 */
export function createSceneRaycast(gl, shaderProgramInfo, camera, UIData)
{
  return {
    uniforms: {
      // Ray Tracing
      u_step_size: UIData.stepSize,
      u_default_step_size: UIData.defaultStepSize,
      u_shading_model: UIData.shadingModel,
      // Light
      u_light: { position: UIData.u_light },
      // Camera
      u_eye_position: camera.u_eye_position,
      u_view_inv: camera.u_view_inv,
      u_projection_inv: camera.u_projection_inv,
      // Shading Model
      u_roughness: UIData.roughness,
      u_subsurface: UIData.subsurface,
      u_sheen: UIData.sheen,
      u_sheen_tint: UIData.sheenTint,
    },
    uniformBlock: {
      info: twgl.createUniformBlockInfo(gl, shaderProgramInfo, "Lights"),
      uniforms: createLightsUBOFromUIData(UIData),
    },
  };
}
