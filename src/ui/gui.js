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
    selectedVolumeMediumKey: Object.keys(appData.environment.volumeMedia)[0],
    volumeMedia: appData.environment.volumeMedia,
  };

  return GUIData;
}

/* ------------------------------------------------------------------------- */
/* TWEAKPANE INITIALIZATION ------------------------------------------------ */
/* ------------------------------------------------------------------------- */

function removeFolderBindings(folder)
{
  for (const child of folder.children)
    folder.remove(child);
}

function addTransferFunctionBinding(folder, GUIData)
{
  const key = GUIData.selectedVolumeMediumKey;
  const medium = GUIData.transferFunction[key];

  folder.addBinding(medium, "interval", { label: key, ...medium.options })
    .on('change', event =>
    {
      const { min, max } = event.value;
      vec2.set(medium.intervalVec, min, max);
    });

  folder.addBinding(medium, "color", {
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

function refreshTransferFunctionBinding(folder, GUIData)
{
  removeFolderBindings(folder);
  addTransferFunctionBinding(folder, GUIData);
}

/**
 * Creates a GUI section for tuning of the transfer function.
 * @param {*} folder Tweakfolder folder object
 * @param {*} GUIData mediator object between GUI and the rest of the application
 */
function addTransferFunctionFolder(folder, GUIData)
{
  const folderTF = folder.addFolder({ title: "Transfer Function" });
  addTransferFunctionBinding(folderTF, GUIData);

  return folderTF;
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

function addShadingModelSelectBinding(folder, GUIData)
{
  const shadingModel = GUIData.volumeMedia[GUIData.selectedVolumeMediumKey].shadingModel;
  const shadingModelsKeys = Object.keys(GUIData.volumeMedia[GUIData.selectedVolumeMediumKey].shadingModelParameters);

  return folder.addBinding(shadingModel, "value", {
    label: "select",
    // WARN: This will probably need to pull the options list from somewhere else when changes are introduced
    options: Object.fromEntries(shadingModelsKeys.map((key, index) => [key, index])),
  })
    .on('change', event =>
    {
      // WARN: This is not flexible
      const index = event.value;
      shadingModel.key = shadingModelsKeys[index];
    });
}

function addShadingModelParametersBindings(folder, GUIData)
{
  const modelKey = GUIData.volumeMedia[GUIData.selectedVolumeMediumKey].shadingModel.key;
  const model = GUIData.volumeMedia[GUIData.selectedVolumeMediumKey].shadingModelParameters[modelKey];
  for (const [paramKey, param] of Object.entries(model))
  {
    folder.addBinding(param, "value", { label: paramKey, ...param.options });
  }
}

function refreshShadingModelParametersBindings(folder, GUIData)
{
  removeFolderBindings(folder);
  addShadingModelParametersBindings(folder, GUIData);
}

function addShadingModelParametersFolder(folder, GUIData)
{
  const folderP = folder.addFolder({ title: "Parameters" });

  addShadingModelParametersBindings(folderP, GUIData);

  return folderP;
}

function addShadingModelBindings(folder, GUIData)
{
  const modelSelectBinding = addShadingModelSelectBinding(folder, GUIData);
  const folderP = addShadingModelParametersFolder(folder, GUIData);

  modelSelectBinding
    .on('change', () =>
    {
      refreshShadingModelParametersBindings(folderP, GUIData);
    });
}

function refreshShadingModelBindings(folder, GUIData)
{
  removeFolderBindings(folder);
  addShadingModelBindings(folder, GUIData);
}

function addShadingModelFolder(folder, GUIData)
{
  const folderSM = folder.addFolder({ title: "Shading Model" });

  addShadingModelBindings(folderSM, GUIData);

  return folderSM;
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

  for (const [key, setting] of Object.entries(GUIData.settings.uniforms.rayTracing))
  {
    const optionalParameters = "isList" in setting.options
      ? { label: key, options: setting.options }
      : { label: key, ...setting.options };

    folderRT.addBinding(setting, "value", optionalParameters);
  }

  addLightsBindings(pane, GUIData);

  const folderVM = pane.addFolder({ title: "Volume Medium" });

  const selectVMBinding = folderVM.addBinding(GUIData, "selectedVolumeMediumKey", {
    label: "select",
    options: Object.fromEntries(Object.keys(GUIData.volumeMedia).map(key => [key, key])),
  });

  folderVM.addBinding(GUIData.volumeMedia[GUIData.selectedVolumeMediumKey].enabled, "value", {
    label: "enable",
  });

  const folderSM = addShadingModelFolder(folderVM, GUIData);

  const folderTF = addTransferFunctionFolder(folderVM, GUIData);

  selectVMBinding
    .on('change', () =>
    {
      refreshShadingModelBindings(folderSM, GUIData);
      refreshTransferFunctionBinding(folderTF, GUIData);
    });

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
