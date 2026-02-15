'use strict'

import { vec2, vec3, vec4 } from 'gl-matrix';

/**
 * Helper function, creates a GPU-compatible representation of the transfer function interval.
 * @param {*} medium transfer function medium object
 * @returns vec2 object containing the given interval
 */
function initIntervalVec(medium)
{
  return vec2.fromValues(medium.interval.min, medium.interval.max);
}

/**
 * Helper function, creates a GPU-compatible representation of the transfer function color.
 * @param {*} medium transfer function medium object, must contain attribute `color`
 * @returns vec4 object containing the given color
 */
function initColorVec(medium)
{
  return vec4.fromValues(medium.color.r, medium.color.g, medium.color.b, medium.color.a);
}

/**
 * Helper function, creates a GPU-compatible representation of a three element vector.
 * @param {*} v object containing x,y,z properties
 * @returns vec3 object containing the given values
 */
function initVec3(v)
{
  return vec3.fromValues(v.x, v.y, v.z);
}

/**
 * Creates the `transferFunction` attribute for the data object. Creates duplicates of vector values
 * in a GPU-compatible format so that they can be sent directly to the GPU as uniforms.
 * @param {*} tf object that defines the transfer function
 * @returns object used in the application data object
 */
function initTransferFunctionProperties(tf)
{
  let transferFunction = {};

  for (const key in tf)
  {
    const medium = tf[key];

    transferFunction[key] = {};
    transferFunction[key].enabled = medium.enabled;
    transferFunction[key].interval = medium.interval;
    transferFunction[key].color = medium.color;
    transferFunction[key].intervalVec = initIntervalVec(medium);
    transferFunction[key].colorVec = initColorVec(medium);
  }

  return transferFunction;
}

/**
 * Creates the `lights` attribute for the data object. Creates duplicates of vector values
 * in a GPU-compatible format so that they can be sent directly to the GPU as uniforms.
 * @param {*} lights object that defines lights in a scene
 * @returns object used in the application data object
 */
function initLightsProperties(lights)
{
  let lightsProperties = {};

  for (const key in lights)
  {
    const light = lights[key];

    lightsProperties[key] = {};
    lightsProperties[key].position = light.position;
    lightsProperties[key].positionVec = initVec3(light.position);
    lightsProperties[key].intensity = light.intensity;
  }

  return lightsProperties;
}

/**
 * Creates the formatted `environment` attribute for the data object. 
 * @param {*} environment to be formatted environment attribute
 * @returns formatted environment attribute
 */
function initEnvironmentProperties(environment)
{
  return {
    ...environment,
    lights: initLightsProperties(environment.lights),
  };
}

/**
 * Initializes the main object used for storing application data.
 * @param {*} settings object with application settings
 * @param {*} environment object with environment data - lights, camera, scene, etc.
 * @param {*} transferFunction object that defines the transfer function
 * @returns object with application related data
 */
export function initAppData(settings, environment, transferFunction)
{
  return {
    settings: settings,
    environment: initEnvironmentProperties(environment),
    transferFunction: initTransferFunctionProperties(transferFunction),
  };
}
