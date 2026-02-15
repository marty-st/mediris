'use strict'

import { Pane } from 'tweakpane';
import * as TweakpaneEssentialsPlugin from '@tweakpane/plugin-essentials';
import { vec2, vec3, vec4 } from 'gl-matrix';

/* ---------------------------------------------------------------------------------- */
/* INTERNAL GUI DATA STRUCTURE INITIALIZATION --------------------------------------------*/
/* ---------------------------------------------------------------------------------- */

/**
 * Creates an object that stores GUI related data.
 * @param {*} appData object with application data
 * @returns mediator object between GUI and the rest of the application
 */
export function initGUIData(appData)
{
  let GUIData = {
    framesPerSecond: 0,
    // App Data
    settings: appData.settings,
    lights: appData.environment.lights,
    transferFunction: appData.transferFunction,
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

  pane.addBinding(GUIData.settings.uniforms.general, "u_mode", {
    options: {
      main: 0,
      debugShader: 1,
    }
  });

  // Ray Tracing
  pane.addBinding(GUIData.settings.uniforms.rayTracing, "u_step_size", {min: 0.0001, max: 0.01, step: 0.0001});
  pane.addBinding(GUIData.settings.uniforms.rayTracing, "u_default_step_size", {min: 0.0001, max: 0.01, step: 0.0001});
  pane.addBinding(GUIData.settings.uniforms.rayTracing, "u_shading_model", { 
    options: {
      Disney: 0,
      Lambert: 1,
      normal: 2,
      position: 3,
    } 
  });

  addLightsBindings(pane, GUIData);

  // Shading Model
  pane.addBinding(GUIData.settings.uniforms.shadingModel, "u_roughness", { min: 0, max: 1 });
  pane.addBinding(GUIData.settings.uniforms.shadingModel, "u_subsurface", { min: 0, max: 1 });
  pane.addBinding(GUIData.settings.uniforms.shadingModel, "u_sheen", { min: 0, max: 1 });
  pane.addBinding(GUIData.settings.uniforms.shadingModel, "u_sheen_tint", { min: 0, max: 1 });

  addTransferFunctionBindings(pane, GUIData);

  return pane;
}
