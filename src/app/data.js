'use strict';

/* GLOBAL VARIABLES */

// HU units are usually defined in the range <-1000, 3000>,
// however, the data loads in unsigned short format, so
// the values must be offset by a constant
const C = 1000;
// Hounsfield units for various media
// template: { min: 0 + C, max: 0 + C },
const hu = {
  air: { min: -1000 + C, max: -950 + C },
  lungs: { min: -750 + C, max: -700 + C },
  fat: { min: -120 + C, max: -90 + C },
  skin: { min: -440 + C, max: 1900 + C },
  water: { min: 0 + C, max: 0 + C },
  muscle: { min: 35 + C, max: 55 + C },
  softTissueContrast: { min: 100 + C, max: 300 + C },
  boneCancellous: { min: 300 + C, max: 400 + C },
  boneCortical: { min: 350 + C, max: 1900 + C }, // USE min: -440 for skin layer, 350 for the bone
  pet: { min: 5000 + C, max: 40000 + C },

};

// Transfer Function Definition
const tf = {
  air: { interval: hu.air, color: { r: 0, g: 0, b: 0, a: 0 } },
  // lungs: { interval: hu.lungs, color: { r: 0.65, g: 0.35, b: 0.11, a: 0.00 } },
  // fat: { interval: hu.fat, color: { r: 0.82, g: 0.83, b: 0.18, a: 0.00 } },
  // water: { interval: hu.water, color: { r: 0.03, g: 0.49, b: 0.87, a: 0.00 } },
  // muscle: { interval: hu.muscle, color: { r: 0.46, g: 0.02, b: 0.02, a: 0.00 } },
  // softTissueContrast: { interval: hu.softTissueContrast, color: { r: 0.66, g: 0.36, b: 0.52, a: 0.00 } },
  // boneCancellous: { interval: hu.boneCancellous, color: { r: 0.41, g: 0.66, b: 0.17, a: 0.0 } },
  // boneCortical: { interval: hu.boneCortical, color: { r: 0.88, g: 0.88, b: 0.88, a: 1.00 } },
  bodyShell: { interval: { min: hu.skin.min, max: hu.boneCortical.max }, color: { r: 0.88, g: 0.88, b: 0.88, a: 1.00 }, options: { min: 50, max: 3000, step: 1 } },
  pet: { interval: hu.pet, color: { r: 0.88, g: 0.88, b: 0.88, a: 1.00 }, options: { min: 3000, max: 40000, step: 1 } },
};

// Lights Setup
const lights = {
  keyLight: {
    position: { x: 0, y: 1, z: -1 },
    intensity: 1.0,
    relativeToCamera: false,
    enabled: false,
  },
  fillLight: {
    position: { x: 1, y: 0.75, z: 0 },
    intensity: 0.5,
    relativeToCamera: false,
    enabled: false,
  },
  backLight: {
    position: { x: 0, y: 0, z: -10 }, // -10 hopes to be far enough to be behind the volume
    intensity: 1.0,
    relativeToCamera: true,
    enabled: true,
  },
};

// Shading Model Setup
const shadingModel = {
  stylized: {
    u_alpha: { value: 0.05, options: { min: 0, max: 1 } },
    u_tau: { value: -1.0, options: { min: -Math.PI, max: Math.PI } },
    u_lambda: { value: 0.0, options: { min: -0.999, max: 0.999 } },
    u_mu: { value: 0.0, options: { min: -1.5, max: 1.5 } },
    u_chi: { value: 1.0, options: { min: -1, max: 1 } },
    u_beta: { value: 0.5, options: { min: -0.5, max: 0.5 } },
    u_gamma: { value: 0.4, options: { min: 0.001, max: 30 } },
  },
  disney: {
    // diffuse model
    u_roughness: { value: 0.5, options: { min: 0, max: 1 } },
    u_subsurface: { value: 0.0, options: { min: 0, max: 1 } },
    u_sheen: { value: 0.0, options: { min: 0, max: 1 } },
    u_sheen_tint: { value: 0.5, options: { min: 0, max: 1 } },
    // specular model
    u_specular: { value: 0.5, options: { min: 0, max: 1 } },
    u_specular_tint: { value: 0.0, options: { min: 0, max: 1 } },
    u_anisotropic: { value: 0.0, options: { min: 0, max: 1 } },
    u_metallic: { value: 0.0, options: { min: 0, max: 1 } },
    u_clearcoat: { value: 0.0, options: { min: 0, max: 1 } },
    u_clearcoat_gloss: { value: 1.0, options: { min: 0, max: 1 } },
  },
  blinnPhong: {
    u_shininess: { value: 100.0, options: { min: 0, max: 1000 } },
  },
  lambert: {},
  normal: {},
  position: {},
  cubemap: {},
};

// TODO: What the fuck
const STYLIZED = { value: 0, key: "stylized" };
const DISNEY = { value: 1, key: "disney" };
const BLINN_PHONG = { value: 2, key: "blinnPhong" };
const LAMBERT = { value: 3, key: "lambert" };
const NORMAL = { value: 4, key: "normal" };
const POSITION = { value: 5, key: "position" };

// TODO: move lights into volumeMedia
// TODO: make shading model parameters dynamic via GUI
// TODO: make enable/disable dynamic via GUI
// TODO: make lights adjustable via GUI
const volumeMedia = {
  bodyShell: {
    enabled: { value: true },
    channel: "ct",
    transferFunction: initTransferFunctionProperties(tf.bodyShell),
    lights: initLightsProperties([lights.backLight]),
    shadingModel: STYLIZED,
    shadingModelParameters: structuredClone(shadingModel),
  },
  pet: {
    enabled: { value: true },
    channel: "pet",
    transferFunction: initTransferFunctionProperties(tf.pet),
    lights: initLightsProperties([lights.keyLight]),
    shadingModel: NORMAL,
    shadingModelParameters: structuredClone(shadingModel),
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
  volumeMedia: volumeMedia,
  scene: undefined,       // Current scene object
  lights: lights,
};

// Application settings
const settings = {
  uniforms: {
    general: {
      u_mode: {
        value: 0,
        options: {
          isList: true,
          main: 0,        // Volume Data
          debugShader: 1, // Debug Sphere
        },
      },
    },
    rayTracing: {
      u_step_size: { value: 0.0025, options: { min: 0.0001, max: 0.01, step: 0.0001 } },
      u_gradient_delta: { value: 0.0025, options: { min: 0.0001, max: 0.05, step: 0.001 } },
      u_curvature_delta_multiplier: { value: 4.0, options: { min: 0.5, max: 6.0, step: 0.1 } },
    },
  },
};

/**/

import { initIntervalVec, initColorVec, initVec3 } from "./helper";

/**
 * Creates the `transferFunction` attribute for the data object. Creates duplicates of vector values
 * in a GPU-compatible format so that they can be sent directly to the GPU as uniforms.
 * @param {*} mediumTF object that defines the medium's transfer function
 * @returns object used in the volumeMedia data object
 */
function initTransferFunctionProperties(mediumTF)
{
  const transferFunction = {
    interval: mediumTF.interval,
    color: mediumTF.color,
    intervalVec: initIntervalVec(mediumTF),
    colorVec: initColorVec(mediumTF),
    options: mediumTF.options,
  };

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

  for (const [key, light] of Object.entries(lights))
  {
    const obj = {
      position: light.position,
      positionVec: initVec3(light.position),
      intensity: light.intensity,
      relativeToCamera: light.relativeToCamera,
      enabled: light.enabled,
    };

    lightsProperties[key] = obj;
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
function initAppDataContent(settings, environment)
{
  return {
    context: null,
    settings: settings,
    environment: initEnvironmentProperties(environment),
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
