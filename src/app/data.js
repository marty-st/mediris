'use strict'

/* GLOBAL VARIABLES */

// HU units are usually defined in the range <-1000, 3000>,
// however, the data loads in unsigned short format, so
// the values must be offset by a constant
const C = 1000;
// Hounsfield units for various media
// template: { min: 0 + C, max: 0 + C },
const hu = {
  air: { min: -1000 + C, max: -950 + C},
  lungs: { min: -750 + C, max: -700 + C },
  fat: { min: -120 + C, max: -90 + C },
  water: { min: 0 + C, max: 0 + C },
  muscle: { min: 35 + C, max: 55 + C },
  softTissueContrast: { min: 100 + C, max: 300 + C },
  boneCancellous: { min: 300 + C, max: 400 + C },
  boneCortical: { min: -440 + C, max: 1900 + C }, // USE min: -440 for skin layer, 350 for the bone
  pet: {min: 5000 + C, max: 40000 + C},

};

// Transfer Function Definition
const tf = {
  air: { interval: hu.air, color: {r: 0, g: 0, b: 0, a: 0}, channel: "ct", enabled: false},
  lungs: { interval: hu.lungs, color: {r: 0.65, g: 0.35, b: 0.11, a: 0.00}, channel: "ct", enabled: false},
  fat: { interval: hu.fat, color: {r: 0.82, g: 0.83, b: 0.18, a: 0.00}, channel: "ct", enabled: false},
  water: { interval: hu.water, color: {r: 0.03, g: 0.49, b: 0.87, a: 0.00}, channel: "ct", enabled: false},
  muscle: { interval: hu.muscle, color: {r: 0.46, g: 0.02, b: 0.02, a: 0.00}, channel: "ct", enabled: false},
  softTissueContrast: { interval: hu.softTissueContrast, color: {r: 0.66, g: 0.36, b: 0.52, a: 0.00}, channel: "ct", enabled: false},
  boneCancellous: { interval: hu.boneCancellous, color: {r: 0.41, g: 0.66, b: 0.17, a: 0.0}, channel: "ct", enabled: false},
  boneCortical: { interval: hu.boneCortical, color: {r: 0.88, g: 0.88, b: 0.88, a: 1.00}, channel: "ct", enabled: true},
  pet: { interval: hu.pet, color: {r: 0.88, g: 0.88, b: 0.88, a: 1.00}, channel: "pet", enabled: true},
};

// Lights Setup
const lights = {
    keyLight: {
      position: {x: 0, y: 1, z: -1},
      intensity: 1.0,
      relativeToCamera: false,
      enabled: false,
    },
    fillLight: {
      position: {x: 1, y: 0.75, z: 0},
      intensity: 0.5,
      relativeToCamera: false,
      enabled: false,
    },
    backLight: {
      position: {x: 0, y: 0, z: -10}, // -10 hopes to be far enough to be behind the volume
      intensity: 1.0,
      relativeToCamera: true,
      enabled: true,
    },
};

// Application time keeping
const time = {
  current: 0,
  previous: 0,
  delta: 0,
};

// Application states
const state = {
 idleRender: false,
};

// Application environment data
const environment = {
  time: time,
  state: state,
  camera: undefined,
  viewport: undefined,    // Viewport position and dimensions
  scene: undefined,       // Current scene object
  lights: lights 
};

// Application settings
const settings = {
  uniforms: {
    general: {
      u_mode: 0, // 0 = Volume Data, 1 = Debug Sphere
    },
    rayTracing: {
      u_step_size: 0.0025,
      u_gradient_delta: 0.0025,
      u_curvature_delta_multiplier: 4.0,
      u_shading_model: 0, // 0 = Stylized, 1 = Disney, 2 = Blinn-Phong, 3 = Lambert, 4 = normal, 5 = position, 6 = cubemap
    },
    shadingModel: {
      stylized: {
        u_alpha: 0.05,
        u_tau: -1.0,
        u_lambda: 0.0,
        u_mu: 0.0,
        u_chi: 1.0,
        u_beta: 0.5,
        u_gamma: 0.4,
      },
      disney: {
        // diffuse model
        u_roughness: 0.5,
        u_subsurface: 0.0,
        u_sheen: 0.0,
        u_sheen_tint: 0.5,
        // specular model
        u_specular: 0.5,
        u_specular_tint: 0.0,
        u_anisotropic: 0.0,
        u_metallic: 0.0,
        u_clearcoat: 0.0,
        u_clearcoat_gloss: 1.0,
      },
      blinnPhong: {
        u_shininess: 100.0,
      },
      lambert: {},
      normal: {},
      position: {},
      cubemap: {},
    },
  },
}

/**/

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
    transferFunction[key].channel = medium.channel === "ct" ? 0 : 1;
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
    lightsProperties[key].relativeToCamera = light.relativeToCamera;
    lightsProperties[key].enabled = light.enabled;
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
function initAppDataContent(settings, environment, transferFunction)
{
  return {
    context: null,
    settings: settings,
    environment: initEnvironmentProperties(environment),
    transferFunction: initTransferFunctionProperties(transferFunction),
  };
}

/**
 * Initializes the main object used for storing application data.
 * @returns object with application related data
 */
export function initAppData()
{
  return initAppDataContent(settings, environment, tf);
}
