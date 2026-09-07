'use strict';

import { vec2, vec3, vec4 } from 'gl-matrix';

/**
 * Copies primitive-type variables as attributes of a new `target` object where each
 * variable has a getter that takes value from the variable's source object.
 * This ensures that primitive-type variables stay synchronized throughout the application.
 * @param  {Object} target target object to which reference variables are placed
 * @param  {...any} primitiveSources source objects to be used for the reference. Each must be: { value: ..., ... }
 * @returns object with variables tied to their source object values
*/
export function createReferencePrimitives(target, ...primitiveSources)
{
  for (const [key, data] of primitiveSources)
  {
    // See: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/defineProperty
    Object.defineProperty(target, key, {
      // By default, properties created with Object.defineProperty are non-enumerable
      // TWGL enumerates over the uniforms object
      enumerable: true,
      // TWGL will access the newly created uniform (key) variable
      // this getter will underneath return the value from the original data.value
      get: () => data.value,
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
