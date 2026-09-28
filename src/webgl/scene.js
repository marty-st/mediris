'use strict';

import createShaderProgram from './program';

import * as twgl from 'twgl.js';
import { createReferencePrimitives } from '../app/helper';

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
 * Creates a raycast scene object with uniform variables used by a shader.
 * These include raycasting properties and camera.
 * @param {*} uniforms object with uniform data
 * @param {*} environment object with environment data - camera, scene, etc.
 * @returns raycast scene object used in the render loop
 */
export function createSceneRaycast(uniforms, environment)
{
  // these are enumerable and contain getters that reach for the original
  // value in the uniforms object given to this function as a parameter
  const referenceUniforms = createReferencePrimitives(
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
  };

  return scene;
}
