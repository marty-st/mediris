'use strict';

import createShaderProgram from './program';

import * as twgl from 'twgl.js';
import { vec3 } from 'gl-matrix';
import { createReferenceUniforms } from '../app/helper';

/**
 * Reloads the shader programs by re-fetching their appropriate text files. Used for application development.
 *  @param {*} gl WebGL rendering context
 *  @param {*} scene object with scene data - uniforms, geometries, shader file names
 */
export async function reloadShaders(gl, scene)
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
 * Updates light properties as some of their attributes are passed by value upon scene initialization
 * and are NOT synchronized with the rest of the application, which takes data from the appData object.
 * @param {*} scene object with scene data - uniforms, geometries, shader file names
 * @param {*} lights object with light data
 * @param {*} camera camera object
 */
export function updateSceneLights(scene, lights, camera)
{
  const lightsUBO = createLightsUBOFromAppData(lights, camera.u_view_inv);
  scene.uniformBlock.uniforms = lightsUBO;
}

/**
 * Transforms information about user-controlled light properties into a GPU compatible
 * format (UBO).
 * @param {*} environment object with environment data - lights, camera, scene, etc.
 * @param {*} cameraInvViewMat camera inverse view matrix
 * @returns object containing an array with per-light data and the array size
 */
function createLightsUBOFromAppData(lights, cameraInvViewMat)
{
  let lightsUBO = {
    lights_array: [],
    lights_array_size: 0,
  };

  for (const light of Object.values(lights))
  {
    if (!light.enabled)
      continue;

    const lightPosition = vec3.clone(light.positionVec);

    // NOTE: I don't like that this happens here
    if (light.relativeToCamera && cameraInvViewMat)
      vec3.transformMat4(lightPosition, lightPosition, cameraInvViewMat);

    lightsUBO.lights_array.push({
      position: lightPosition,
      intensity: light.intensity,
    });
  }

  lightsUBO.lights_array_size = lightsUBO.lights_array.length;

  return lightsUBO;
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
  // these are enumerable and contain getters that reach for the original
  // value in the uniforms object given to this function as a parameter
  const referenceUniforms = createReferenceUniforms(
    {},
    ...Object.entries(uniforms.general),
    ...Object.entries(uniforms.rayTracing)
  );

  // Camera uniforms
  referenceUniforms.u_eye_position = environment.camera.u_eye_position;
  referenceUniforms.u_view_inv = environment.camera.u_view_inv;
  referenceUniforms.u_projection_inv = environment.camera.u_projection_inv;

  const scene = {
    geometries: [],
    uniforms: referenceUniforms,
    // Lights
    uniformBlock: {
      info: twgl.createUniformBlockInfo(gl, shaderProgramInfo, "Lights"),
      uniforms: createLightsUBOFromAppData(environment.lights),
    },
  };

  return scene;
}
