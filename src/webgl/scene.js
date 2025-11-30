'use strict'

import * as twgl from 'twgl.js';

export function createSceneEmpty()
{
  return {
    uniforms: null,
  };
}

function getLightsFromUIData(UIData)
{
  let lights = {
    array: [],
  };

  for (const key in UIData.lights)
  {
    const light = UIData.lights[key];

    lights.array.push({
      position: light.positionVec,
    });
  }

  lights.array_size = lights.array.length;

  return lights;
}

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
      uniforms: getLightsFromUIData(UIData),
    },
  };
}
