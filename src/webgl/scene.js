'use strict'

export function createSceneEmpty()
{
  return {
    uniforms: null,
  };
}

export function createSceneRaycast(UIData, camera)
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
    }
  };
}
