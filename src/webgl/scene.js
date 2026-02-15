'use strict'

import * as twgl from 'twgl.js';

/**
 * Reloads the shader programs by re-fetching their appropriate text files. Used for application development.
 *  @param {*} scene object with scene data - uniforms, geometries, shader file names
 */
export async function reloadShaders(scene)
{
  for (const geometry of scene.geometries)
  {
    const shader = geometry.shaderFileNames;
  
    geometry.programInfo = await createShaderProgram(gl, shader.vert, shader.frag, false);
  
    if (geometry.uniformBlock)
    {
      const blockName = geometry.uniformBlock.info.name;
      geometry.uniformBlock.info = twgl.createUniformBlockInfo(gl, geometry.programInfo, blockName);
    }
  }
  
  // Uniforms and UBOs are shared by all geometries in a scene, hence only needs to be set once
  if (scene.geometries?.length > 0 && scene.uniformBlock)
  {
    const blockName = scene.uniformBlock.info.name;
    scene.uniformBlock.info = twgl.createUniformBlockInfo(gl, scene.geometries[0].programInfo, blockName);
  }

  console.log("Reloaded shaders");
}

/**
 * Updates copies of float-type uniform variables stored in scene.uniforms. These are not synchronized
 * with their appData counterpart as they are passed by value when scene is initialized, thus requiring
 * manual update each frame.
 * @param {*} scene object with scene data - uniforms, geometries, shader file names
 * @param {*} uniforms object with uniform data
 */
export function updateSceneFloatUniforms(scene, uniforms)
{
  for (const values of Object.values(uniforms)) 
  {
    for (const key in values) 
    {
      const value = values[key]; 
      
      if (typeof value !== 'object' || value === null) 
        scene.uniforms[key] = value;
    }
  }
}

/**
 * Updates float-type light properties as these are passed by value upon scene initialization and are NOT
 * synchronized with the rest of the application, which takes data from the appData object.
 * @param {*} scene object with scene data - uniforms, geometries, shader file names
 * @param {*} lights object with light data
 */
export function updateSceneLights(scene, lights)
{
  let i = 0;
  for (const key in lights)
  {
    scene.uniformBlock.uniforms.lights_array[i].intensity = lights[key].intensity;
    ++i;
  }
}

/**
 * Transforms information about user-controlled light properties into a GPU compatible
 * format (UBO). 
 * @param {*} environment object with environment data - lights, camera, scene, etc.
 * @returns object containing an array with per-light data and the array size
 */
function createLightsUBOFromAppData(environment)
{
  let lights = {
    lights_array: [],
    lights_array_size: 0
  };

  for (const key in environment.lights)
  {
    const light = environment.lights[key];

    lights.lights_array.push({
      position: light.positionVec,
      intensity: light.intensity,
    });
  }

  lights.lights_array_size = lights.lights_array.length;

  return lights;
}

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
 * Creates a raycast scene object with uniform variables and uniform blocks used 
 * by a shader. These include raycasting properties, light sources, camera, shading
 * model properties.
 * @param {*} gl WebGL rendering context
 * @param {*} shaderProgramInfo associated shader program
 * @param {*} uniforms object with uniform data
 * @param {*} environment object with environment data - lights, camera, scene, etc.
 * @returns raycast scene object used in the render loop
 */
export function createSceneRaycast(gl, shaderProgramInfo, uniforms, environment)
{
  let scene = {
    geometries: [],
    uniforms: {
      ...uniforms.general,
      ...uniforms.rayTracing,
      ...uniforms.shadingModel,
      // Camera
      u_eye_position: environment.camera.u_eye_position,
      u_view_inv: environment.camera.u_view_inv,
      u_projection_inv: environment.camera.u_projection_inv,
    },
    // Lights
    uniformBlock: {
      info: twgl.createUniformBlockInfo(gl, shaderProgramInfo, "Lights"),
      uniforms: createLightsUBOFromAppData(environment),
    },
  };

  return scene;
}
