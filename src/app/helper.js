'use strict';

import { vec2, vec3, vec4 } from 'gl-matrix';

/**
 * Copies primitive-type uniforms as attributes of a new 'uniforms' object where each
 * uniform has a getter that takes value from the uniform's source object.
 * This ensures that primitive-type uniforms stay synchronized between the scene and
 * the rest of the application.
 * @param  {Object} target target object to which reference uniforms are placed
 * @param  {...any} primitiveUniformSources source uniform objects to be used for the reference
 * @returns object with uniforms tied to their source object values
*/
export function createReferenceUniforms(target, ...primitiveUniformSources)
{
  for (const [key, uniform] of primitiveUniformSources)
  {
    // See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty
    Object.defineProperty(target, key, {
      // By default, properties created with Object.defineProperty are non-enumerable
      // TWGL enumerates over the uniforms object
      enumerable: true,
      // TWGL will access the newly created uniform (key) variable
      // this getter will underneath return the value from the original uniform.value
      get: () => uniform.value,
    });
  }

  return target;
}

/**
 * Helper function, creates a GPU-compatible representation of the transfer function interval.
 * @param {*} medium transfer function medium object
 * @returns vec2 object containing the given interval
 */
export function initIntervalVec(medium)
{
  return vec2.fromValues(medium.interval.min, medium.interval.max);
}

/**
 * Helper function, creates a GPU-compatible representation of the transfer function color.
 * @param {*} medium transfer function medium object, must contain attribute `color`
 * @returns vec4 object containing the given color
 */
export function initColorVec(medium)
{
  return vec4.fromValues(medium.color.r, medium.color.g, medium.color.b, medium.color.a);
}

/**
 * Helper function, creates a GPU-compatible representation of a three element vector.
 * @param {*} v object containing x,y,z properties
 * @returns vec3 object containing the given values
 */
export function initVec3(v)
{
  return vec3.fromValues(v.x, v.y, v.z);
}
