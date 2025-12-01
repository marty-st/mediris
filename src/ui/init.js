'use strict'

import { Pane } from 'tweakpane';
import * as TweakpaneEssentialsPlugin from '@tweakpane/plugin-essentials';
import { vec2, vec3, vec4 } from 'gl-matrix';

/**
 * Helper function, creates a GPU-compatible representation of the transfer function interval
 * @param {*} medium transfer function medium object
 * @returns vec2 object containing the given interval
 */
function initIntervalVec(medium)
{
  return vec2.fromValues(medium.interval.min, medium.interval.max);
}

/**
 * Helper function, creates a GPU-compatible representation of the transfer function color
 * @param {*} medium transfer function medium object
 * @returns vec4 object containing the given color
 */
function initColorVec(medium)
{
  return vec4.fromValues(medium.color.r, medium.color.g, medium.color.b, medium.color.a);
}

/**
 * Helper function, creates a GPU-compatible representation of a three element vector
 * @param {*} v object containing x,y,z properties
 * @returns vec3 object containing the given values
 */
function initVec3(v)
{
  return vec3.fromValues(v.x, v.y, v.z);
}

/**
 * Creates the transfer function property used by the UI. Creates duplicates of vector values
 * in a GPU-compatible format so that they can be sent directly to the GPU as uniforms.
 * @param {*} tf object that defines the transfer function
 * @returns object used by UI library
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
 * Creates an object that stores UI related data
 * @param {*} tf object that defines the transfer function
 * @param {*} l object that defines lights in a scene
 * @returns mediator object between UI and the rest of the application
 */
export function initUIData(tf, l)
{
  let UIData = {
    framesPerSecond: 0,
    mode: 0,
    // Ray Tracing
    defaultStepSize: 0.0025,
    stepSize: 0.0025,
    shadingModel: 0,
    // Lights
    lights: initLightsProperties(l),
    // Shading Model
    roughness: 0.1,
    subsurface: 0.0,
    sheen: 0.0,
    sheenTint: 0.0,
    // Transfer Function
    transferFunction: initTransferFunctionProperties(tf),
  };

  return UIData;
}

/**
 * Creates a UI section for tuning of the transfer function
 * @param {*} pane Tweakpane global-state object
 * @param {*} UIData mediator object between UI and the rest of the application
 */
function addTransferFunctionBindings(pane, UIData)
{
  const folderTF = pane.addFolder({ title: "Transfer Function" });

  for (const key in UIData.transferFunction)
  {
    if (!UIData.transferFunction[key].enabled)
      continue;

    folderTF.addBinding(UIData.transferFunction[key], "interval", {
      label: key,
      min: 0,
      max: 4095,
      step: 1,
    })
    .on('change', (event) => {
      const { min, max } = event.value;
      vec2.set(UIData.transferFunction[key].intervalVec, min, max);
    });

    folderTF.addBinding(UIData.transferFunction[key], "color", {
      color: { type: "float" },
      picker: "inline",
      expanded: false,
    })
    .on('change', (event) => {
      const { r, g, b, a } = event.value;
      vec4.set(UIData.transferFunction[key].colorVec, r, g, b, a);
    });  
  }
}

/**
 * Creates a UI section for controlling the light sources
 * @param {*} pane Tweakpane global-state object
 * @param {*} UIData mediator object between UI and the rest of the application
 */
function addLightsBindings(pane, UIData)
{
  for (const key in UIData.lights)
  {
    pane.addBinding(UIData.lights[key], "position", 
    { 
      label: key,
      min: -1, 
      max: 1,
    })
    .on('change', (event) => {
      const {x, y, z} = event.value;
      vec3.set(UIData.lights[key].positionVec, x, y, z);
    });

    pane.addBinding(UIData.lights[key], "intensity",
    {
      min: 0,
      max: 1,
    })
  }
}

/**
 * Initializes the context of Tweakpane UI elements for debugging purposes
 * @param UIData object that reflects states of Tweakpane controlled variables
 * @returns `Pane`object
 */
export function initDebugUI(UIData)
{
  const pane = new Pane();

  pane.registerPlugin(TweakpaneEssentialsPlugin);

  pane.addBinding(UIData, "framesPerSecond", {
        readonly: true,
        label: "FPS",
        view: "graph",
        min: 0,
        max: 200
    });

  pane.addBinding(UIData, "mode", {
    options: {
      main: 0,
      debugShader: 1,
    }
  });

  pane.addBinding(UIData, "stepSize", {min: 0.0001, max: 0.01, step: 0.0001});
  pane.addBinding(UIData, "defaultStepSize", {min: 0.0001, max: 0.01, step: 0.0001});
  pane.addBinding(UIData, "shadingModel", { 
    options: {
      Disney: 0,
      Lambert: 1,
      normal: 2,
      position: 3,
    } 
  });

  addLightsBindings(pane, UIData);
  // pane.addBinding(UIData, "light", { min: -1, max: 1 })
  // .on('change', (event) => {
  //   const {x, y, z} = event.value;
  //   vec3.set(UIData.u_light, x, y, z);
  // });

  pane.addBinding(UIData, "roughness", { min: 0, max: 1 });
  pane.addBinding(UIData, "subsurface", { min: 0, max: 1 });
  pane.addBinding(UIData, "sheen", { min: 0, max: 1 });
  pane.addBinding(UIData, "sheenTint", { min: 0, max: 1 });

  addTransferFunctionBindings(pane, UIData);

  return pane;
}
