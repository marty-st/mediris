'use strict'

import { Pane } from 'tweakpane';
import * as TweakpaneEssentialsPlugin from '@tweakpane/plugin-essentials';
import { vec2, vec3, vec4 } from 'gl-matrix';

/* ---------------------------------------------------------------------------------- */
/* INTERNAL GUI DATA STRUCTURE INITIALIZATION --------------------------------------------*/
/* ---------------------------------------------------------------------------------- */

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
 * Creates the `transferFunction` attribute for the GUI object. Creates duplicates of vector values
 * in a GPU-compatible format so that they can be sent directly to the GPU as uniforms.
 * @param {*} tf object that defines the transfer function
 * @returns object used by the GUI library
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
 * Creates the `lights` attribute for the GUI object. Creates duplicates of vector values
 * in a GPU-compatible format so that they can be sent directly to the GPU as uniforms.
 * @param {*} lights object that defines lights in a scene
 * @returns object used by the GUI library
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
 * Creates an object that stores GUI related data.
 * @param {*} tf object that defines the transfer function
 * @param {*} l object that defines lights in a scene
 * @returns mediator object between GUI and the rest of the application
 */
export function initGUIData(tf, l)
{
  let GUIData = {
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

  return GUIData;
}

/* ------------------------------------------------------------------------- */
/* TWEAKPANE INITIALIZATION ------------------------------------------------ */
/* ------------------------------------------------------------------------- */

/**
 * Creates a GUI section for tuning of the transfer function.
 * @param {*} pane Tweakpane global-state object
 * @param {*} GUIData mediator object between GUI and the rest of the application
 */
function addTransferFunctionBindings(pane, GUIData)
{
  const folderTF = pane.addFolder({ title: "Transfer Function" });

  for (const key in GUIData.transferFunction)
  {
    if (!GUIData.transferFunction[key].enabled)
      continue;

    folderTF.addBinding(GUIData.transferFunction[key], "interval", {
      label: key,
      min: 0,
      max: 4095,
      step: 1,
    })
    .on('change', (event) => {
      const { min, max } = event.value;
      vec2.set(GUIData.transferFunction[key].intervalVec, min, max);
    });

    folderTF.addBinding(GUIData.transferFunction[key], "color", {
      color: { type: "float" },
      picker: "inline",
      expanded: false,
    })
    .on('change', (event) => {
      const { r, g, b, a } = event.value;
      vec4.set(GUIData.transferFunction[key].colorVec, r, g, b, a);
    });  
  }
}

/**
 * Creates a GUI section for controlling the light sources.
 * @param {*} pane Tweakpane global-state object
 * @param {*} GUIData mediator object between GUI and the rest of the application
 */
function addLightsBindings(pane, GUIData)
{
  for (const key in GUIData.lights)
  {
    pane.addBinding(GUIData.lights[key], "position", 
    { 
      label: key,
      min: -1, 
      max: 1,
    })
    .on('change', (event) => {
      const {x, y, z} = event.value;
      vec3.set(GUIData.lights[key].positionVec, x, y, z);
    });

    pane.addBinding(GUIData.lights[key], "intensity",
    {
      min: 0,
      max: 1,
    })
  }
}

/**
 * Initializes the context of Tweakpane GUI elements for debugging purposes.
 * @param GUIData object that reflects states of Tweakpane controlled variables
 * @returns `Pane`object
 */
export function initDebugGUI(GUIData)
{
  const pane = new Pane();

  pane.registerPlugin(TweakpaneEssentialsPlugin);

  pane.addBinding(GUIData, "framesPerSecond", {
        readonly: true,
        label: "FPS",
        view: "graph",
        min: 0,
        max: 200
    });

  pane.addBinding(GUIData, "mode", {
    options: {
      main: 0,
      debugShader: 1,
    }
  });

  pane.addBinding(GUIData, "stepSize", {min: 0.0001, max: 0.01, step: 0.0001});
  pane.addBinding(GUIData, "defaultStepSize", {min: 0.0001, max: 0.01, step: 0.0001});
  pane.addBinding(GUIData, "shadingModel", { 
    options: {
      Disney: 0,
      Lambert: 1,
      normal: 2,
      position: 3,
    } 
  });

  addLightsBindings(pane, GUIData);

  pane.addBinding(GUIData, "roughness", { min: 0, max: 1 });
  pane.addBinding(GUIData, "subsurface", { min: 0, max: 1 });
  pane.addBinding(GUIData, "sheen", { min: 0, max: 1 });
  pane.addBinding(GUIData, "sheenTint", { min: 0, max: 1 });

  addTransferFunctionBindings(pane, GUIData);

  return pane;
}
