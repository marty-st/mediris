'use strict';

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
    idle: false,
    framesPerSecond: 0,
    // App Data
    settings: appData.settings,
    lights: appData.environment.lights,
    // lights: Object.fromEntries(Object.entries(appData.environment.volumeMedia)
    //   .map(([key, medium]) => [key, medium.lights])), // TODO: Is it needed?
    transferFunction: Object.fromEntries(Object.entries(appData.environment.volumeMedia)
      .map(([key, medium]) => [key, medium.transferFunction])),
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

  for (const [key, medium] of Object.entries(GUIData.transferFunction))
  {
    folderTF.addBinding(medium, "interval", { label: key, ...medium.options })
      .on('change', event =>
      {
        const { min, max } = event.value;
        vec2.set(medium.intervalVec, min, max);
      });

    folderTF.addBinding(medium, "color", {
      color: { type: "float" },
      picker: "inline",
      expanded: false,
    })
      .on('change', event =>
      {
        const { r, g, b, a } = event.value;
        vec4.set(medium.colorVec, r, g, b, a);
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
  const folderLights = pane.addFolder({ title: "Lights" });

  for (const [key, light] of Object.entries(GUIData.lights))
  {
    const lightToggle = folderLights.addBinding(light, "enabled", { label: "toggle " + key });

    const lightPosition = folderLights.addBinding(light, "position", {
      label: key,
      min: -10,
      max: 10,
    })
      .on('change', event =>
      {
        const { x, y, z } = event.value;
        vec3.set(light.positionVec, x, y, z);
      });

    const lightIntensity = folderLights.addBinding(light, "intensity", {
      min: 0,
      max: 1,
    });

    // initial visibility
    lightPosition.hidden = !light.enabled;
    lightIntensity.hidden = !light.enabled;

    // visibility toggle
    lightToggle
      .on('change', event =>
      {
        lightPosition.hidden = !event.value;
        lightIntensity.hidden = !event.value;
      });
  }
}

function addShadingModelBindings(pane, GUIData, modelBinding)
{
  const folderSM = pane.addFolder({ title: "Shading Model" });

  const shadingModelBindings = {};
  for (const [modelKey, model] of Object.entries(GUIData.settings.uniforms.shadingModel))
  {
    shadingModelBindings[modelKey] = [];
    for (const paramKey in model)
    {
      const setting = model[paramKey];
      const uniformBinding = folderSM.addBinding(setting, "value", { label: paramKey, ...setting.options });
      const modelIndex = Object.keys(shadingModelBindings).length - 1;
      // Show only default
      uniformBinding.hidden = modelIndex !== GUIData.settings.uniforms.rayTracing.u_shading_model.value;

      shadingModelBindings[modelKey].push(uniformBinding);
    }
  }

  // Toggle visibility based on selected model
  modelBinding.on('change', event =>
  {
    // Hide all first
    for (const model of Object.values(shadingModelBindings))
    {
      model.forEach(uniformBinding =>
      {
        uniformBinding.hidden = true;
      });
    }

    // Show only the selected model's bindings
    const modelName = Object.keys(GUIData.settings.uniforms.shadingModel)[event.value];
    shadingModelBindings[modelName].forEach(uniformBinding =>
    {
      uniformBinding.hidden = false;
    });

  });
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
    max: 200,
  });

  // General
  pane.addBinding(GUIData.settings.uniforms.general.u_mode, "value", {
    label: "u_mode",
    options: GUIData.settings.uniforms.general.u_mode.options,
  });

  // Ray Tracing
  const folderRT = pane.addFolder({ title: "Ray Tracing" });
  let modelBinding;

  for (const [key, setting] of Object.entries(GUIData.settings.uniforms.rayTracing))
  {
    const optionalParameters = "isList" in setting.options
      ? { label: key, options: setting.options }
      : { label: key, ...setting.options };

    const binding = folderRT.addBinding(setting, "value", optionalParameters);

    if (key === "u_shading_model")
      modelBinding = binding;
  }

  addLightsBindings(pane, GUIData);

  // TODO: dynamic shading model parameters
  // addShadingModelBindings(pane, GUIData, modelBinding);

  addTransferFunctionBindings(pane, GUIData);

  pane
    .on('change', event =>
    {
    // Ignore self-updating components
      if (event.target.key == "framesPerSecond")
        return;
      GUIData.idle = false;
    });

  return pane;
}

/**
 * Resets states affected by the 'on-change' event handler of the GUI pane.
 * @param {*} GUIData mediator object between GUI and the rest of the application
 */
export function resetGUIState(GUIData)
{
  GUIData.idle = true;
}
